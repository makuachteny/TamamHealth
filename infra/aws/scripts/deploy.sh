#!/usr/bin/env bash
# =============================================================================
# infra/aws/scripts/deploy.sh — wrapper around `aws cloudformation deploy`.
#
# Usage:
#   ./infra/aws/scripts/deploy.sh \
#       --env staging \
#       --domain staging.tamamhealth.org \
#       --acm-cert arn:aws:acm:af-south-1:111111111111:certificate/abc... \
#       --instance-type t3.medium \
#       --image-tag staging \
#       --keypair tamamhealth-staging
#
#   Optional:
#       --region <region>          default af-south-1
#       --stack-name <name>        default tamamhealth-<env>
#       --db-password-from-ssm     read DB password from
#                                  /tamamhealth/<env>/DB_MASTER_PASSWORD
#                                  (recommended; otherwise prompted at TTY).
#       --dry-run                  print the cmd but don't execute.
#
# Validates:
#   - aws CLI present and authenticated
#   - region is one of af-south-1 / eu-south-2 (PHI residency guard)
#   - ACM cert ARN is in the same region as the deploy
#   - the af-south-1 region is opted in on this account
#   - keypair exists
#
# Refuses to run if any of the above fail.
# =============================================================================
set -euo pipefail

usage() {
  sed -n '3,30p' "$0" | sed 's/^# \{0,1\}//'
  exit "${1:-1}"
}

ENVNAME=""
DOMAIN=""
ACM_CERT=""
INSTANCE_TYPE="t3.medium"
IMAGE_TAG=""
KEYPAIR=""
REGION="af-south-1"
STACK_NAME=""
DB_PASS_FROM_SSM=0
DRY_RUN=0

while [ $# -gt 0 ]; do
  case "$1" in
    --env)            ENVNAME="${2:?}"; shift 2 ;;
    --domain)         DOMAIN="${2:?}"; shift 2 ;;
    --acm-cert)       ACM_CERT="${2:?}"; shift 2 ;;
    --instance-type)  INSTANCE_TYPE="${2:?}"; shift 2 ;;
    --image-tag)      IMAGE_TAG="${2:?}"; shift 2 ;;
    --keypair)        KEYPAIR="${2:?}"; shift 2 ;;
    --region)         REGION="${2:?}"; shift 2 ;;
    --stack-name)     STACK_NAME="${2:?}"; shift 2 ;;
    --db-password-from-ssm) DB_PASS_FROM_SSM=1; shift ;;
    --dry-run)        DRY_RUN=1; shift ;;
    -h|--help)        usage 0 ;;
    *) echo "error: unknown arg: $1" >&2; usage 1 ;;
  esac
done

die() { echo "error: $*" >&2; exit 1; }
say() { echo "[deploy.sh] $*"; }

[ -n "$ENVNAME" ]      || die "--env required (staging|production)"
[ -n "$DOMAIN" ]       || die "--domain required"
[ -n "$ACM_CERT" ]     || die "--acm-cert required"
[ -n "$IMAGE_TAG" ]    || die "--image-tag required"
[ -n "$KEYPAIR" ]      || die "--keypair required"

case "$ENVNAME" in
  staging|production) ;;
  *) die "--env must be 'staging' or 'production' (got '$ENVNAME')" ;;
esac

case "$REGION" in
  af-south-1|eu-south-2) ;;
  *) die "PHI residency: --region must be af-south-1 (preferred) or eu-south-2 (escalation only). Got '$REGION'." ;;
esac

if [ -z "$STACK_NAME" ]; then
  STACK_NAME="tamamhealth-${ENVNAME}"
fi

command -v aws >/dev/null 2>&1 || die "aws CLI not installed. https://aws.amazon.com/cli/"

if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  die "aws CLI not authenticated for region $REGION. Run 'aws configure' or set AWS_PROFILE."
fi

# ACM cert region must match the deploy region — ALB cannot use a cert from
# another region. (CloudFront would require us-east-1, but we don't use
# CloudFront in this baseline; see infra/aws/README.md.)
ACM_REGION=$(echo "$ACM_CERT" | awk -F: '{print $4}')
if [ "$ACM_REGION" != "$REGION" ]; then
  die "ACM cert is in region '$ACM_REGION' but the deploy region is '$REGION'. ALB requires a cert in the same region."
fi

# Region opt-in check (af-south-1 is opt-in).
OPT_STATUS=$(aws ec2 describe-regions --region "$REGION" \
               --region-names "$REGION" \
               --query 'Regions[0].OptInStatus' --output text 2>/dev/null || echo "unknown")
case "$OPT_STATUS" in
  opted-in|opt-in-not-required) ;;
  *) die "region '$REGION' is not opted-in for this account (status: $OPT_STATUS). Enable it in Account Settings -> Regions and wait ~24h before retrying." ;;
esac

# Keypair existence check.
if ! aws ec2 describe-key-pairs --region "$REGION" --key-names "$KEYPAIR" >/dev/null 2>&1; then
  die "EC2 keypair '$KEYPAIR' not found in $REGION. Create it (or pass --keypair) and re-run."
fi

# Resolve the image references. The platform images live on GHCR; the
# deploy needs the FULL ghcr.io/owner/image:tag reference. We let the
# operator pass the tag and infer the repo from the GH org.
GH_OWNER="${GH_OWNER:-tamamhealth}"
PLATFORM_IMAGE="ghcr.io/${GH_OWNER}/tamamhealth-platform:${IMAGE_TAG}"
WEBSITE_IMAGE="ghcr.io/${GH_OWNER}/tamamhealth-website:${IMAGE_TAG}"

# DB password sourcing.
if [ "$DB_PASS_FROM_SSM" = "1" ]; then
  say "fetching DB master password from SSM (/tamamhealth/${ENVNAME}/DB_MASTER_PASSWORD)"
  DB_PASS=$(aws ssm get-parameter \
              --region "$REGION" \
              --name "/tamamhealth/${ENVNAME}/DB_MASTER_PASSWORD" \
              --with-decryption \
              --query 'Parameter.Value' --output text 2>/dev/null) \
    || die "could not read SSM parameter /tamamhealth/${ENVNAME}/DB_MASTER_PASSWORD"
else
  if [ -t 0 ]; then
    printf 'RDS master password (16+ chars, alnum+!@#$%%^&*()_+=-): '
    stty -echo
    IFS= read -r DB_PASS
    stty echo
    echo
  else
    DB_PASS="${TAMAM_DB_PASSWORD:-}"
    [ -n "$DB_PASS" ] || die "stdin is not a TTY and TAMAM_DB_PASSWORD is unset; use --db-password-from-ssm or pipe via env."
  fi
fi
[ "${#DB_PASS}" -ge 16 ] || die "DB password must be at least 16 characters"

TEMPLATE="$(cd "$(dirname "$0")/.." && pwd)/cloudformation/platform.yml"
[ -f "$TEMPLATE" ] || die "template not found: $TEMPLATE"

say "stack:        $STACK_NAME"
say "region:       $REGION"
say "env:          $ENVNAME"
say "domain:       $DOMAIN"
say "instance:     $INSTANCE_TYPE"
say "platform img: $PLATFORM_IMAGE"
say "website  img: $WEBSITE_IMAGE"
say "template:     $TEMPLATE"

CMD=(aws cloudformation deploy
     --region "$REGION"
     --stack-name "$STACK_NAME"
     --template-file "$TEMPLATE"
     --capabilities CAPABILITY_NAMED_IAM CAPABILITY_IAM
     --no-fail-on-empty-changeset
     --parameter-overrides
       "Region=$REGION"
       "EnvironmentName=$ENVNAME"
       "DomainName=$DOMAIN"
       "ACMCertificateArn=$ACM_CERT"
       "PlatformImage=$PLATFORM_IMAGE"
       "WebsiteImage=$WEBSITE_IMAGE"
       "GHOwner=$GH_OWNER"
       "InstanceType=$INSTANCE_TYPE"
       "KeyPairName=$KEYPAIR"
       "DBMasterPassword=$DB_PASS")

if [ "$DRY_RUN" = "1" ]; then
  say "DRY RUN — would execute:"
  # Mask the password
  printf '  '
  for arg in "${CMD[@]}"; do
    case "$arg" in
      DBMasterPassword=*) printf "'DBMasterPassword=***' " ;;
      *) printf "'%s' " "$arg" ;;
    esac
  done
  echo
  exit 0
fi

"${CMD[@]}"

say "deploy complete. Stack outputs:"
aws cloudformation describe-stacks \
    --region "$REGION" \
    --stack-name "$STACK_NAME" \
    --query 'Stacks[0].Outputs' \
    --output table

cat <<NOTE

Next steps:
  1. Set DATABASE_URL in Doppler for the '${ENVNAME}' config:
       postgres://tamamhealth:<password>@<RDSEndpoint>:5432/safeguard_junub?sslmode=require
  2. Point Route 53 at the ALB DNS shown above (alias A record).
  3. Tail boot logs: aws logs tail /aws/ec2/tamamhealth-${ENVNAME} --follow
  4. Smoke-check: curl -sI https://${DOMAIN}/ | head -1   (expect 200 or 302)
  5. See infra/aws/scripts/cutover.md for VPS->AWS cutover.
NOTE

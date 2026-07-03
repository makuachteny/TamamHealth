import { redirect } from "next/navigation";

// This route used to carry its own set of fabricated case studies (named
// hospitals, dollar figures, a fake attributed quote) with no disclaimer that
// they weren't real. TamamHealth is pre-launch and has no deployments to
// report on — /case-studies is now the single, honest source for this
// content, so send visitors there instead of maintaining two divergent pages.
export default function ResourcesCaseStudiesRedirect() {
  redirect("/case-studies");
}

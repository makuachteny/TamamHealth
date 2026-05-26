import type { TranslationMap } from '../index';

const fr: TranslationMap = {
  // ── App ──
  'app.name': 'TamamHealth',
  'app.tagline': 'Dossiers de Santé Numériques',

  // ── Navigation ──
  'nav.dashboard': 'Tableau de Bord',
  'nav.patients': 'Patients',
  'nav.consultation': 'Consultation',
  'nav.appointments': 'Rendez-vous',
  'nav.referrals': 'Références',
  'nav.lab': 'Résultats de Labo',
  'nav.pharmacy': 'Pharmacie',
  'nav.immunizations': 'Vaccinations',
  'nav.anc': 'Soins Prénataux',
  'nav.births': 'Enregistrement des Naissances',
  'nav.deaths': 'Enregistrement des Décès',
  'nav.surveillance': 'Surveillance des Maladies',
  'nav.hospitals': 'Hôpitaux',
  'nav.reports': 'Rapports',
  'nav.messages': 'Messages',
  'nav.settings': 'Paramètres',
  'nav.telehealth': 'Télésanté',
  'nav.government': 'Gouvernement',

  // ── Common actions ──
  'action.save': 'Enregistrer',
  'action.cancel': 'Annuler',
  'action.delete': 'Supprimer',
  'action.edit': 'Modifier',
  'action.search': 'Rechercher',
  'action.filter': 'Filtrer',
  'action.export': 'Exporter',
  'action.print': 'Imprimer',
  'action.back': 'Retour',
  'action.next': 'Suivant',
  'action.submit': 'Soumettre',
  'action.close': 'Fermer',
  'action.confirm': 'Confirmer',
  'action.addNote': 'Ajouter une Note',
  'action.newConsultation': 'Nouvelle Consultation',
  'action.sendMessage': 'Envoyer un Message',
  'action.refer': 'Référer',

  // ── Status ──
  'status.online': 'En Ligne',
  'status.offline': 'Hors Ligne',
  'status.syncing': 'Synchronisation',
  'status.loading': 'Chargement...',
  'status.noData': 'Aucune donnée disponible',

  // ── Patient ──
  'patient.name': 'Nom du Patient',
  'patient.hospitalNumber': 'Numéro d\'Hôpital',
  'patient.age': 'Âge',
  'patient.gender': 'Genre',
  'patient.male': 'Masculin',
  'patient.female': 'Féminin',
  'patient.phone': 'Téléphone',
  'patient.bloodType': 'Groupe Sanguin',
  'patient.location': 'Localisation',
  'patient.tribe': 'Tribu',
  'patient.language': 'Langue',
  'patient.registered': 'Inscrit',
  'patient.facility': 'Établissement',
  'patient.nextOfKin': 'Proche Parent',
  'patient.nokPhone': 'Tél. Proche',
  'patient.allergies': 'Allergies',
  'patient.chronicConditions': 'Maladies Chroniques',
  'patient.medications': 'Médicaments Actuels',
  'patient.demographics': 'Démographie',
  'patient.noneKnown': 'Aucune connue',
  'patient.notFound': 'Patient introuvable.',

  // ── Vitals ──
  'vitals.title': 'Derniers Signes Vitaux',
  'vitals.temperature': 'Température',
  'vitals.bloodPressure': 'Tension Artérielle',
  'vitals.pulse': 'Pouls',
  'vitals.respRate': 'Fréq. Resp.',
  'vitals.spo2': 'SpO₂',
  'vitals.weight': 'Poids',
  'vitals.height': 'Taille',
  'vitals.bmi': 'IMC',

  // ── Encounters ──
  'encounters.recent': 'Consultations Récentes',
  'encounters.history': 'Historique Médical Complet',
  'encounters.outpatient': 'Ambulatoire',
  'encounters.inpatient': 'Hospitalisation',
  'encounters.emergency': 'Urgence',

  // ── Tabs ──
  'tab.overview': 'Aperçu',
  'tab.medicalHistory': 'Historique Médical',
  'tab.vitals': 'Signes Vitaux',
  'tab.labResults': 'Résultats de Labo',
  'tab.prescriptions': 'Ordonnances',
  'tab.referrals': 'Références',

  // ── Referrals ──
  'referral.title': 'Historique des Références',
  'referral.reason': 'Motif',
  'referral.notes': 'Notes Cliniques',
  'referral.none': 'Aucun historique de référence pour ce patient.',
  'referral.sent': 'Envoyée',
  'referral.received': 'Reçue',
  'referral.seen': 'En Cours',
  'referral.completed': 'Terminée',
  'referral.cancelled': 'Annulée',

  // ── Lab ──
  'lab.title': 'Résultats de Laboratoire',
  'lab.testName': 'Test',
  'lab.result': 'Résultat',
  'lab.unit': 'Unité',
  'lab.reference': 'Référence',
  'lab.status': 'Statut',
  'lab.normal': 'Normal',
  'lab.abnormal': 'Anormal',
  'lab.critical': 'CRITIQUE',

  // ── Auth / Session ──
  'auth.login': 'Connexion',
  'auth.logout': 'Déconnexion',
  'auth.sessionLocked': 'Session Verrouillée',
  'auth.enterPin': 'Entrez le PIN pour déverrouiller',
  'auth.switchUser': 'Changer d\'Utilisateur',
  'auth.autoLock': 'Verrouillé automatiquement après inactivité',

  // ── Dates / Time ──
  'time.years': 'ans',
  'time.months': 'mois',
  'time.days': 'jours',
  'time.today': 'Aujourd\'hui',
  'time.yesterday': 'Hier',
};

export default fr;

/**
 * Nuer (Thok Naath) translation skeleton.
 * Translates the common nav + actions; everything else falls back to English
 * via the loader. Native-speaker review pending — values flagged with
 * `// pending` should be QC'd before customer-facing release.
 */
import type { TranslationMap } from '../index';

const nus: TranslationMap = {
  // ── App ──
  'app.name': 'TamamHealth',
  'app.tagline': 'Yoaŋ ɛ kuoth ŋäc',          // pending — health partner

  // ── Navigation ──
  'nav.dashboard': 'Päädh',                     // pending — overview
  'nav.patients': 'Naath cuɔ̈ɔk',               // pending — sick people
  'nav.consultation': 'Cuɔ̈ɔr',                 // consultation
  'nav.appointments': 'Cäŋ kak',                // pending
  'nav.referrals': 'Tuɔɔc',
  'nav.lab': 'Bath ŋäc',                        // pending — testing place
  'nav.pharmacy': 'Käm ɣääŋ',                   // pending — medicine store
  'nav.immunizations': 'Mut tuany',
  'nav.anc': 'Cuɔ̈ɔr cieŋ',                     // pending — pregnancy care
  'nav.births': 'Dhiɛɛth',
  'nav.deaths': 'Liaa',
  'nav.surveillance': 'Däy ŋäc',                // pending
  'nav.hospitals': 'Wath ŋäc',                  // pending
  'nav.reports': 'Käp',
  'nav.messages': 'Wel',
  'nav.settings': 'Look',
  'nav.telehealth': 'Ŋäc cieŋ ce ku',
  'nav.government': 'Cuɔ̈l puɔɔr',

  // ── Common actions ──
  'action.save': 'Muk',
  'action.cancel': 'Päl piny',
  'action.delete': 'Tek wëi',
  'action.edit': 'Lok',
  'action.search': 'Wic',
  'action.filter': 'Kuany',
  'action.export': 'Nyok',
  'action.print': 'Gat',
  'action.add': 'Mat',
  'action.close': 'Pal',
  'action.back': 'Dhuk',
  'action.next': 'Dhuk tuek',
  'action.confirm': 'Lät',
  'action.submit': 'Tek',

  // ── Vitals ──
  'vitals.title': 'Käŋ guöp',
  'vitals.temperature': 'Tuk guöp',
  'vitals.bloodPressure': 'Riem',
  'vitals.pulse': 'Tuk lɔc',
  'vitals.respRate': 'Tëŋ thuɔɔr',
  'vitals.spo2': 'Yom riem',
  'vitals.weight': 'Diɛk',
  'vitals.height': 'Bäl',
  'vitals.bmi': 'BMI',

  // ── Auth ──
  'auth.logout': 'Bä',
};

export default nus;

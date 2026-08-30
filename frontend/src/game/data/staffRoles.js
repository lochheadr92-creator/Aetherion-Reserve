// ---- Data-driven staff role definitions (shared by sim + economy + UI) ----

export const STAFF_ROLES = {
  xenobiologist: {
    id: 'xenobiologist', name: 'Field Xenobiologist', short: 'Xenobiologist',
    hire: 800, wage: 120,
    desc: 'Hand-feeds hungry organisms, clears biowaste from exhibits and gathers observation evidence toward discoveries.',
    duties: ['Hand-feeding', 'Biowaste removal', 'Field observation'],
  },
  biomedical: {
    id: 'biomedical', name: 'Biomedical Officer', short: 'Biomedical',
    hire: 900, wage: 140,
    desc: 'Locates stressed or unhealthy organisms and stabilises them in the field, reducing containment incidents.',
    duties: ['Stress sedation', 'Health stabilisation'],
  },
  warden: {
    id: 'warden', name: 'Containment Warden', short: 'Warden',
    hire: 1000, wage: 150,
    desc: 'Patrols the perimeter and repairs damaged barrier segments before they collapse — no repair invoices.',
    duties: ['Barrier repair', 'Perimeter patrol'],
  },
};

export const STAFF_ROLE_LIST = Object.values(STAFF_ROLES);

export const STAFF_NAMES = [
  'R. Voss', 'M. Chen', 'T. Aldana', 'K. Ishii', 'S. Reyes',
  'Y. Petrov', 'A. Ngata', 'L. Farah', 'J. Marlowe', 'D. Okafor',
  'E. Lindqvist', 'H. Barros', 'N. Kade', 'O. Tanaka', 'P. Sylla',
];

export const TASK_LABELS = {
  feed: 'Hand-feeding',
  clean: 'Clearing biowaste',
  treat: 'Field treatment',
  observe: 'Observing behaviour',
  repair: 'Repairing barrier',
  patrol: 'Patrolling',
};

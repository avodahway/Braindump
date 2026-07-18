export type SampleBrainDump = {
  label: string;
  text: string;
};

export const sampleBrainDumps: SampleBrainDump[] = [
  {
    label: 'Busy morning',
    text: [
      'Pay employees tomorrow.',
      'Lunch with Jack Thursday at noon; put on calendar.',
      'Waiting on Aaron to send estimate.',
      'Buy printer paper.'
    ].join('\n')
  },
  {
    label: 'Project sweep',
    text: [
      'Start project: prep launch checklist.',
      'Call Sarah Friday at 2pm; put on calendar.',
      'Waiting on design approval from Matt.',
      'Review grocery budget tonight.'
    ].join('\n')
  },
  {
    label: 'After meeting',
    text: [
      'Add task to send notes to team tomorrow.',
      'Follow-up meeting Tuesday at 10am; put on calendar.',
      'Waiting on Chris to confirm numbers.',
      'Set up project: beta tester onboarding.'
    ].join('\n')
  }
];

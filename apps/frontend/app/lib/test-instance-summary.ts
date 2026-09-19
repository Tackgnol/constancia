import type { ListTestInstances200DataItem } from '@constancia/api-client/model';

export type TestInstanceView = ListTestInstances200DataItem;

/** "2 of 4 submitted" for the GM breakdown header. */
export function summarizeSubmissions(participants: TestInstanceView['participants']): string {
  const submitted = participants.filter((participant) => participant.submitted).length;
  return `${submitted} of ${participants.length} submitted`;
}

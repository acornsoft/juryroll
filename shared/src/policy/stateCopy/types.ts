export type PreparedVoter = {
  csv: string;
  protectedCount: number;
};

export type StateBanner = {
  text: string;
  hideOn?: string;
};

export type StateCopy = {
  letterLines: readonly string[];
  juryCountLabel: string | null;
  runningQuestion: string | null;
  replaceRunningQuestion: boolean;
  pipelineLead: string | null;
  suppressJuryCount: boolean;
  refusalExtras: readonly string[];
  banners: readonly StateBanner[];
  csvGuideHref: string | null;
  prepareVoter: ((text: string, hasHeader: boolean) => PreparedVoter | null) | null;
};

export const EMPTY_STATE_COPY: StateCopy = {
  letterLines: [],
  juryCountLabel: null,
  runningQuestion: null,
  replaceRunningQuestion: false,
  pipelineLead: null,
  suppressJuryCount: false,
  refusalExtras: [],
  banners: [],
  csvGuideHref: null,
  prepareVoter: null,
};

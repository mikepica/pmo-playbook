// This file allows gradual migration from MongoDB to PostgreSQL
export const DATABASE_CONFIG = {
  // Set to 'postgres' when ready to switch
  projects: process.env.USE_POSTGRES_PROJECTS === 'true' ? 'postgres' : 'mongodb',
  humanSops: process.env.USE_POSTGRES_SOPS === 'true' ? 'postgres' : 'mongodb',
  agentSops: process.env.USE_POSTGRES_SOPS === 'true' ? 'postgres' : 'mongodb',
  chatHistories: process.env.USE_POSTGRES_CHAT === 'true' ? 'postgres' : 'mongodb',
  userFeedback: process.env.USE_POSTGRES_FEEDBACK === 'true' ? 'postgres' : 'mongodb',
  messageFeedback: process.env.USE_POSTGRES_FEEDBACK === 'true' ? 'postgres' : 'mongodb',
  changeProposals: process.env.USE_POSTGRES_PROPOSALS === 'true' ? 'postgres' : 'mongodb',
  sopVersionHistories: process.env.USE_POSTGRES_SOPS === 'true' ? 'postgres' : 'mongodb',
  users: process.env.USE_POSTGRES_USERS === 'true' ? 'postgres' : 'mongodb',
};

export type DatabaseProvider = 'mongodb' | 'postgres';
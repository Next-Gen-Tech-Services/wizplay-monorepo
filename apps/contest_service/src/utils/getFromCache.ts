import redis from "../configs/redis.config";

export const getMatches = async () => {
  const currentDate = new Date().toLocaleDateString();
  const result = await redis.getter(currentDate);
  return result;
};

export const filterMatchById = async (matches: any[], matchId?: string) => {
  const match = matches.find((value, index) => {
    return value.key === matchId;
  });
  return match;
};

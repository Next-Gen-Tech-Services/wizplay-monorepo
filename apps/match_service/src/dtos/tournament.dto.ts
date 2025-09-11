export interface ITournamentAtters {
  id: string;
  key: string;
  name: string;
  shortName: string | null;
  alternateName: string;
  alternateShortName: string;
  createdAt?: Date;
  updatedAt?: Date;
}

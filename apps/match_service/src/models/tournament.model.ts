import { DataTypes, Model, Optional, Sequelize } from "sequelize";
import { ITournamentAtters } from "../dtos/tournament.dto";

interface TournamentCreationAttrs
  extends Optional<ITournamentAtters, "id" | "createdAt" | "updatedAt"> {}

export class Tournament
  extends Model<ITournamentAtters, TournamentCreationAttrs>
  implements ITournamentAtters
{
  public id!: string;
  public key!: string;
  public name!: string;
  public shortName!: string | null;
  public alternateName!: string;
  public alternateShortName!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

export default function (sequelize: Sequelize) {
  Tournament.init(
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      name: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      shortName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      alternateName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
      alternateShortName: {
        type: DataTypes.STRING,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      modelName: "Tournament",
      timestamps: true,
      underscored: true,
    }
  );

  return Tournament;
}

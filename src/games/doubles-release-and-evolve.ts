import type { IGameFile } from '../types/games';
import {
	game as doublesBattleEliminationTournamentGame, DoublesBattleEliminationTournament
} from './templates/doubles-battle-elimination-tournament';

const name = "Doubles Release and Evolve";
const description = "Every player is given a randomly generated team to start out. Each battle that you win, you " +
	"must 'release' 2 of your Pokemon (remove them from your team) and then evolve 2 Pokemon on your team.";

// max players > 32 eventually runs out of memory
class DoublesReleaseAndEvolve extends DoublesBattleEliminationTournament {
	canChangeFormat = true;
	firstRoundExtraTime = 5 * 60 * 1000;
	dropsPerRound = 2;
	evolutionsPerRound = 2;
	startingTeamsLength = 6;
	maxPlayers = 32;
	minTeamSize = 2;
	requiredDrop = true;
	requiredEvolution = true;
	canReroll = true;
	baseHtmlPageGameName = name;
	htmlPageGameDescription = description;
}

export const game: IGameFile<DoublesReleaseAndEvolve> = Games.copyTemplateProperties(doublesBattleEliminationTournamentGame, {
	aliases: ['doublesrande', 'doublesre', 'doublesreleaseevolve', 'dre'],
	class: DoublesReleaseAndEvolve,
	description,
	name,
	variants: [
		{
			name: "Doubles Release and Evolve Ubers",
			canChangeFormat: false,
			battleFormatId: "gen9doublesubers",
			variantAliases: ["ubers", "uber", "doublesubers"],
		},
		{
			name: "Doubles Release and Evolve UU",
			canChangeFormat: false,
			battleFormatId: "gen9doublesuu",
			variantAliases: ["uu", "doublesuu"],
		},
	],
});

import type { IGameFile } from '../types/games';
import {
	game as doublesBattleEliminationTournamentGame, DoublesBattleEliminationTournament
} from './templates/doubles-battle-elimination-tournament';

const name = "Doubles Catch and Evolve";
const description = "Every player is given 2 randomly generated Pokemon to use as their starters. Each battle that you win, you " +
	"must 'catch' 2 of your opponent's Pokemon (add them to your team) and then evolve 2 Pokemon on your team.";

class DoublesCatchAndEvolve extends DoublesBattleEliminationTournament {
	canChangeFormat = true;
	additionsPerRound = 2;
	evolutionsPerRound = 2;
	startingTeamsLength = 2;
	maxPlayers = 64;
	requiredAddition = true;
	requiredEvolution = true;
	canReroll = true;
	baseHtmlPageGameName = name;
	htmlPageGameDescription = description;
}

export const game: IGameFile<DoublesCatchAndEvolve> = Games.copyTemplateProperties(doublesBattleEliminationTournamentGame, {
	aliases: ['doublescande', 'doublesce', 'doublescatchevolve', 'dce'],
	class: DoublesCatchAndEvolve,
	description,
	name,
	variants: [
		// {
		// 	name: "Monoregion Doubles Catch and Evolve",
		// 	canChangeFormat: false,
		// 	monoRegion: true,
		// 	variantAliases: ["monoregion", "monogen"],
		// },
		{
			name: "Doubles Catch and Evolve Ubers",
			canChangeFormat: false,
			battleFormatId: "gen9doublesubers",
			variantAliases: ["ubers", "uber", "doublesubers"],
		},
		{
			name: "Doubles Catch and Evolve UU",
			canChangeFormat: false,
			battleFormatId: "gen9doublesuu",
			variantAliases: ["uu", "doublesuu"],
		},
	],
});

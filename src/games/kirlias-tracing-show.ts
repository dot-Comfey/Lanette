import type { IGameAchievement, IGameCachedData, IGameFile } from "../types/games";
import { game as questionAndAnswerGame, QuestionAndAnswer } from './templates/question-and-answer';

type AchievementNames = "thegreatestshowman";

class KirliasTracingShow extends QuestionAndAnswer {
	static achievements: KeyedDict<AchievementNames, IGameAchievement> = {
		'thegreatestshowman': {name: "The Greatest Showman", type: 'all-answers', bits: 1000, description: "get every answer in one game"},
	};
	static cachedData: IGameCachedData = {};

	allAnswersAchievement = KirliasTracingShow.achievements.thegreatestshowman;
	hintPrefix: string = "Kirlia traced";

	static async loadData(): Promise<void> { // eslint-disable-line @typescript-eslint/require-await
		const hints: Dict<string[]> = {};
		const hintKeys: string[] = [];

		for (const pokemon of Games.getPokemonList()) {
			const abilities: string[] = [];
			for (const ability in pokemon.abilities) {
				// @ts-expect-error
				abilities.push(pokemon.abilities[ability]); // eslint-disable-line @typescript-eslint/no-unsafe-argument
			}
			hints[pokemon.name] = abilities;
			hintKeys.push(pokemon.name);
		}

		this.cachedData.hintAnswers = hints;
		this.cachedData.hintKeys = hintKeys;
	}
}

const commands = Tools.deepClone(questionAndAnswerGame.commands!);
if (!commands.guess.aliases) commands.guess.aliases = [];
commands.guess.aliases.push('trace');

export const game: IGameFile<KirliasTracingShow> = Games.copyTemplateProperties(questionAndAnswerGame, {
	aliases: ['kirlias', 'kts'],
	category: 'knowledge-1',
	class: KirliasTracingShow,
	commandDescriptions: [Config.commandCharacter + "trace [ability]"],
	commands,
	defaultOptions: ['points'],
	description: "Players guess abilities that the chosen Pokemon have!",
	freejoin: true,
	name: "Kirlia's Tracing Show",
	mascot: "Kirlia",
	minigameCommand: 'kirliatrace',
	minigameCommandAliases: ['ktrace'],
	minigameDescription: "Use <code>" + Config.commandCharacter + "g</code> to guess an ability that the given Pokemon has!",
	modes: ["abridged", "collectiveteam", "multianswer", "pmtimeattack", "prolix", "spotlightteam", "survival", "timeattack"],
	variants: [
		{
			name: "Kirlia's Tracing Show (GIFs)",
			variantAliases: ["gif", "gifs"],
			pokemonGifHints: true,
		},
	],
});

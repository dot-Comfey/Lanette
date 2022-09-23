import type { Player } from "../../room-activity";
import type { ScriptedGame } from "../../room-game-scripted";
import { addPlayers, assert, assertStrictEqual, runCommand } from "../../test/test-tools";
import type {
	DefaultGameOption, GameCommandDefinitions, GameCommandReturnType,
	GameFileTests, IGameFormat, IGameModeFile, IGameNumberOptionValues, IModeInputProperties
} from "../../types/games";
import type { QuestionAndAnswer } from "../templates/question-and-answer";

const BASE_POINTS = 20;

const name = 'Elimination';
const description = '';
const removedOptions: string[] = ['points', 'freejoin'];

type EliminationThis = QuestionAndAnswer & Elimination;

class Elimination {
	cooldownBetweenRounds: number = 5 * 1000;
	readonly loserPointsToBits: number = 5;
	readonly winnerPointsToBits: number = 25;
	readonly playerRounds = new Map<Player, number>();

	static resolveInputProperties<T extends ScriptedGame>(format: IGameFormat<T>,
		customizableNumberOptions: Dict<IGameNumberOptionValues>): IModeInputProperties {
		const namePrefixes: string[] = [];
		if (!format.name.includes(name)) namePrefixes.unshift(name);

		const defaultOptions = format.defaultOptions.slice();
		for (const option of removedOptions) {
			const index = defaultOptions.indexOf(option as DefaultGameOption);
			if (index !== -1) defaultOptions.splice(index, 1);

			delete customizableNumberOptions[option];
		}

		customizableNumberOptions.points = {
			min: BASE_POINTS,
			base: BASE_POINTS,
			max: BASE_POINTS,
		};

		return {
			customizableNumberOptions,
			defaultOptions,
			description: format.description + ' ' + description,
			namePrefixes,
		};
	}

	onStart(this: EliminationThis): void {
		this.maxCorrectPlayersPerRound = this.getRemainingPlayerCount() - 1;
		this.minimumAnswersPerHint = this.getRemainingPlayerCount() - 1;
		this.timeout = setTimeout(() => this.nextRound(), 5 * 1000);
	}

	onAnswerTimeLimit(this: EliminationThis): void {
		this.say("Time is up!");
		if (this.answers.length) {
			this.displayAnswers();
			this.answers = [];
		}
		for (const player in this.players) {
			let playerGuessed = false;
			for (const i in this.correctPlayers) {
				if (this.players[player] === this.correctPlayers[i]) playerGuessed = true;
			}
			let eliminatedPlayer = this.players[player];
			if (!playerGuessed) this.eliminatePlayer(eliminatedPlayer);
		}
		if (this.getRemainingPlayerCount() < 2) {
			this.end();
		} else {
			this.maxCorrectPlayersPerRound = this.getRemainingPlayerCount() - 1;
			this.minimumAnswersPerHint = this.getRemainingPlayerCount() - 1;
			this.nextRound();
		}
	}

	onEnd(this: EliminationThis): void {
		for (const i in this.players) {
			const player = this.players[i];
			if (player.eliminated) continue;
			this.winners.set(player, 1);
			this.addBits(player, 500);
		}

		this.announceWinners();

		this.playerRounds.clear();
	}

	onForceEnd(this: EliminationThis): void {
		this.playerRounds.clear();
	}

	onIncorrectGuess(this: EliminationThis, player: Player, guess: string): string {
		if (this.roundGuesses && this.checkAnswer(guess, this.guessedAnswers)) this.roundGuesses.delete(player);
		return "";
	}

	getPointsForAnswer(this: EliminationThis): number {
		let answers = this.roundAnswersCount;
		if (answers > this.maxCorrectPlayersPerRound) answers = this.maxCorrectPlayersPerRound;
		return answers - this.correctPlayers.length;
	}
}

const commandDefinitions: GameCommandDefinitions<EliminationThis> = {
	guess: {
		command(target, room, user, cmd): GameCommandReturnType {
			if (this.answerCommands && !this.answerCommands.includes(cmd)) return false;

			const player = this.players[user.id];
			if (!this.canGuessAnswer(player)) return false;

			const answer = this.guessAnswer(player, target);
			if (!answer || !this.canGuessAnswer(player)) return false;

			if (this.timeout) clearTimeout(this.timeout);

			if (this.onCorrectGuess) this.onCorrectGuess(player, answer);

			this.correctPlayers.push(player);
			this.removeAnswer(answer);
			player.say("You have moved on to the next round!");
			if (this.maxCorrectPlayersPerRound === this.correctPlayers.length) this.onAnswerTimeLimit();
			return true;
		},
		aliases: ['g'],
	},
};

const commands = CommandParser.loadCommandDefinitions(commandDefinitions);

const initialize = (game: QuestionAndAnswer): void => {
	const mode = new Elimination();
	const propertiesToOverride = Object.getOwnPropertyNames(mode)
		.concat(Object.getOwnPropertyNames(Elimination.prototype)) as (keyof Elimination)[];
	for (const property of propertiesToOverride) {
		// @ts-expect-error
		game[property] = mode[property];
	}

	game.loadModeCommands(commands);
};

const tests: GameFileTests<EliminationThis> = {
	'it should have the necessary methods': {
		config: {
			async: true,
		},
		async test(game): Promise<void> {
			this.timeout(15000);

			await game.onNextRound();
			assert(game.answers.length);
			assert(game.roundTime);
		},
	},
	'it should not end the round when the answer is guessed': {
		config: {
			commands: [['guess'], ['g']],
		},
		async test(game, format, attributes): Promise<void> {
			this.timeout(15000);

			addPlayers(game);
			game.start();
			await game.onNextRound();
			assert(game.answers.length);
			game.canGuess = true;
			runCommand(attributes.commands![0], game.answers[0], game.room, "Player 1");
			const player = game.players['player1'];
			assert(player);
			assert(game.answers.length);
			assertStrictEqual(game.correctPlayers.length, 1);
			assert(game.correctPlayers.includes(player));
			runCommand(attributes.commands![0], game.answers[0], game.room, "Player 1");
			assertStrictEqual(game.correctPlayers.length, 1);
		},
	},
};

export const mode: IGameModeFile<Elimination, QuestionAndAnswer, EliminationThis> = {
	aliases: ['elim'],
	challengeSettings: {
		botchallenge: {
			enabled: false,
		},
		onevsone: {
			enabled: false,
		},
	},
	class: Elimination,
	description,
	initialize,
	name,
	naming: 'prefix',
	tests,
};

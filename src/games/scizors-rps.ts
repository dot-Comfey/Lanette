import type { Player } from "../room-activity";
import { ScriptedGame } from "../room-game-scripted";
import type { IPokemon } from "../types/pokemon-showdown";
import type { GameCommandDefinitions, IGameFile } from "../types/games";

const data: {pokemon: string[]} = {
	pokemon: [],
};

class ScizorsRPS extends ScriptedGame {
	allMatchups: Player[][] = [];
    canSelect: boolean = false;
    lastBye: Player | null = null;
    matchupPlayers: Player[] = [];
    matchupsWon = new Map<Player, number>();
    selectedMatchupPokemon = new Map<Player, IPokemon>();
    playerOrder: Player[] = [];
	roundRobin?: boolean;

    static loadData(): void {
		data.pokemon = Games.getPokemonList().map(x => x.name);
	}

	onStart(): void {
		this.nextRound();
	}

	onNextRound(): void {
		if (!this.roundRobin) {
			if (this.getRemainingPlayerCount() === 1) {
				return this.end();
			}
			const html = this.getRoundHtml(players => this.getPlayerNames(players));
			const uhtmlName = this.uhtmlBaseName + '-round-html';
			this.sayUhtml(uhtmlName, html);
			this.playerOrder = this.shufflePlayers();
			if (this.playerOrder.length % 2 === 1) {
				while (this.playerOrder[this.playerOrder.length - 1] === this.lastBye) {
					this.playerOrder = this.shufflePlayers();
				}
			}
		} else {
			this.playerOrder = this.shufflePlayers();
			for (let i = 0; i < this.playerOrder.length; i++) {
				for (let j = i + 1; j < this.playerOrder.length; j++) {
					this.allMatchups.push([this.playerOrder[i], this.playerOrder[j]]);
				}
			}
			this.shuffle(this.allMatchups);
		}
		this.createMatchup();
	}

    createMatchup(): void {
        this.matchupPlayers = [];
		if (!this.roundRobin) {
			for (let i = 0; i < 2; i++) {
				if (this.playerOrder[0]) {
					this.matchupPlayers.push(this.playerOrder[0]);
					this.playerOrder.shift();
				}
			}
			if (this.matchupPlayers.length === 2) {
				this.startMatchup(this.matchupPlayers);
			} else {
				if (this.matchupPlayers.length === 1) this.lastBye = this.playerOrder[0];
				this.nextRound();
			}
		} else {
			if (this.allMatchups.length) {
				this.matchupPlayers.push(this.allMatchups[0][0]);
				this.matchupPlayers.push(this.allMatchups[0][1]);
				this.allMatchups.shift();
				this.startMatchup(this.matchupPlayers);
			} else {
				this.end();
			}
		}
    }

    startMatchup(players: Player[]): void {
		this.selectedMatchupPokemon.clear();

		const text = Tools.joinList(players.map(x => x.name)) + " please select a Pokemon in PMs with the command ``" +
			Config.commandCharacter + "select [Pokemon]``!";
		this.on(text, () => {
			this.canSelect = true;
			this.timeout = setTimeout(() => this.calculateMatchup(), 30 * 1000);
		});
		this.say(text);
	}

    calculateMatchup(): void {
		if (this.timeout) clearTimeout(this.timeout);
		this.canSelect = false;
        let currentPokemon = [];

        for (const i in this.matchupPlayers) {
            currentPokemon.push(this.selectedMatchupPokemon.get(this.matchupPlayers[i]));
        }
		if (!currentPokemon[0] && !currentPokemon[1]) {
            for (const i in this.matchupPlayers) {
                this.eliminatePlayer(this.matchupPlayers[i]);
                this.removePlayerFromOrder(this.matchupPlayers[i]);
            }
			const text = "Neither player selected a Pokemon and were eliminated from the game!";
			this.on(text, () => {
				this.timeout = setTimeout(() => this.createMatchup(), 3 * 1000);
			});
			this.say(text);
			return;
		}

		let matchupWinner;
		if (currentPokemon[0] && currentPokemon[1]) {
			const winner = Games.getMatchupWinner(currentPokemon[0], currentPokemon[1]);
			if (winner === currentPokemon[0]) {
				matchupWinner = this.matchupPlayers[0];
			} else if (winner === currentPokemon[1]) {
				matchupWinner = this.matchupPlayers[1];
			}
		} else {
			if (currentPokemon[0]) {
				matchupWinner = this.matchupPlayers[0];
			} else if (currentPokemon[1]) {
				matchupWinner = this.matchupPlayers[1];
			}
		}

		let tie = false;
		let text = '';
		if (!matchupWinner) {
			tie = true;
			text = "It was a tie between " + this.matchupPlayers[0].name + "'s " + currentPokemon[0]!.name + " and " +
            this.matchupPlayers[1].name + "'s " + currentPokemon[1]!.name + "!";
		} else {
			if (matchupWinner === this.matchupPlayers[0]) {
				text = this.handleMatchupResult(this.matchupPlayers[0], this.matchupPlayers[1], currentPokemon[0]!, currentPokemon[1]);
			} else if (matchupWinner = this.matchupPlayers[1]) {
				text = this.handleMatchupResult(this.matchupPlayers[1], this.matchupPlayers[0], currentPokemon[1]!, currentPokemon[0]);
			}
		}

		if (tie) {
			this.on(text, () => {
				this.timeout = setTimeout(() => this.startMatchup(this.matchupPlayers), 3 * 1000);
			});
		} else {
            this.on(text, () => {
				this.timeout = setTimeout(() => this.createMatchup(), 3 * 1000);
			});
		}

		this.say(text);
	}

    handleMatchupResult(winner: Player, loser: Player, winnerPokemon: IPokemon, loserPokemon?: IPokemon): string {
		if (!this.roundRobin) {
			this.eliminatePlayer(loser);
			this.removePlayerFromOrder(loser);
		}

		const matchupsWon = this.matchupsWon.get(winner) || 0;
		this.matchupsWon.set(winner, matchupsWon + 1);

		if (loserPokemon) {
			return loser.name + "'s " + loserPokemon.name + " was defeated by " + winner.name + "'s " + winnerPokemon.name + "! " +
			(!this.roundRobin ? " " + loser.name + " has been eliminated from the game!" : "");
		} else {
			return loser.name + " did not select a Pokemon" + (!this.roundRobin ? " and was eliminated from the game" : "") + "!";
		}
	}

    removePlayerFromOrder(player: Player): void {
        const index = this.playerOrder.indexOf(player);
        if (index !== -1) this.playerOrder.splice(index, 1);
	}

	onEnd(): void {
		/*const winner = this.getFinalPlayer();

        for (const i in this.players) {
            let totalBits = 0;
            const matchupsWon = this.matchupsWon.get(this.players[i]);
            if (matchupsWon) {
                totalBits += matchupsWon * 50
                if (this.players[i] === winner) {
                    this.winners.set(winner, 1);
                    totalBits += 250;
                }
                this.addBits(this.players[i], totalBits);
            }
        }*/

		let winner;

        if (!this.roundRobin) {
			winner = this.getFinalPlayer();
			if (winner) {
				this.winners.set(winner, 1);
				this.addBits(winner, 500);
			}
		} else {
			let mostMatchupsWon = 0;
			for (const id in this.players) {
				const player = this.players[id];
				const matchupsWon = this.matchupsWon.get(this.players[id]);
				if (!matchupsWon) continue;
				if (matchupsWon > mostMatchupsWon) {
					this.winners.clear();
					this.winners.set(player, matchupsWon);
					mostMatchupsWon = matchupsWon;
				} else if (matchupsWon === mostMatchupsWon) {
					this.winners.set(player, matchupsWon);
				}
			}
			this.winners.forEach((value, player) => {
				this.addBits(player, 500);
			});
		}

        for (const i in this.players) {
            if (this.winners.has(this.players[i])) continue;
            const matchupsWon = this.matchupsWon.get(this.players[i]);
            if (matchupsWon) {
                this.addBits(this.players[i], matchupsWon * 50);
            }
        }

		this.announceWinners();
	}

	onRemovePlayer(player: Player): void {
		if (!this.started) return;

		this.removePlayerFromOrder(player);

		if (this.matchupPlayers.includes(player)) {
			this.cancelMatchup(player);
		}

		if (this.roundRobin) {
			for (let i = 0; i < this.allMatchups.length; i++) {
				if (this.allMatchups[i].includes(player)) this.allMatchups.splice(i, 1);
			}
		}
	}

	cancelMatchup(loser: Player): void {
		if (this.timeout) clearTimeout(this.timeout);
		this.canSelect = false;

		const text = loser.name + " did not select a Pokemon and was eliminated from the game!";
		this.on(text, () => {
			this.timeout = setTimeout(() => this.createMatchup(), 3 * 1000);
		});
		this.say(text);
	}
}

const commands: GameCommandDefinitions<ScizorsRPS> = {
	select: {
		command(target, room, user) {
			if (!this.canSelect || !this.matchupPlayers.includes(this.players[user.id]) ||
				this.selectedMatchupPokemon.has(this.players[user.id])) {
				return false;
			}
			const player = this.players[user.id];
			const pokemon = Dex.getPokemon(target);
			if (!pokemon) {
				player.say(CommandParser.getErrorText(['invalidPokemon', target]));
				return false;
			}

			if (!data.pokemon.includes(pokemon.name)) {
				player.say(pokemon.name + " cannot be used in this game. Please choose something else!");
				return false;
			}

			player.say("You have selected " + pokemon.name + "!");
			this.selectedMatchupPokemon.set(player, pokemon);
			if (this.selectedMatchupPokemon.size === this.matchupPlayers.length) {
				this.calculateMatchup();
			}
			return true;
		},
		pmOnly: true,
	},
};

export const game: IGameFile<ScizorsRPS> = {
	aliases: ["scizors", "rps"],
	category: 'luck',
	commandDescriptions: [Config.commandCharacter + "select [Pokemon]"],
	commands,
	class: ScizorsRPS,
	description: "A Pokemon themed rock paper scissors tournament where typings determine the winner. PM a Pokemon to the host in hopes " + 
    "of having a type advantage over your opponent.",
	name: "Scizor's RPS",
	mascot: "Scizor",
	variants: [
		{
			name: "Round Robin Scizor's RPS",
			aliases: ['rrrps'],
			variantAliases: ['roundrobin'],
			roundRobin: true,
		},
	],
};

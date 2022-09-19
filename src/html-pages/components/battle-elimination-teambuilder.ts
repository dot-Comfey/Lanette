import type { BattleElimination, IRoundTeamRequirements, ITeamChange } from "../../games/templates/battle-elimination";
import type { Player } from "../../room-activity";
import type { HtmlPageBase } from "../html-page-base";
import { ComponentBase, type IComponentProps } from "./component-base";

export interface IBattleEliminationTeambuilderProps extends IComponentProps {
	game: BattleElimination;
	player: Player;
	rerollCommand: string;
}

const addPokemonCommand = 'addpokemon';
const dropPokemonCommand = 'droppokemon';
const evolvePokemonCommand = 'evolvepokemon';
const devolvePokemonCommand = 'devolvepokemon';
const changeRoundCommand = 'changeround';

export class BattleEliminationTeambuilder extends ComponentBase {

	componentId: string = 'battle-elimination-teambuilder';
	declare props: IBattleEliminationTeambuilderProps;

	availableEvolutions: number = 0;
	currentRound: number = 1;
	moreRoundsAvailableMessage: string = "";
	remainingRoundAdditions: number = 0;
	remainingRoundDrops: number = 0;
	remainingRoundEvolutions: number = 0;
	roundDropChoices: string[] = [];
	roundEvolvedSlots: number[] = [];
	roundTeamChange: DeepMutable<ITeamChange> | undefined = undefined;
	roundSlots: Dict<string[] | undefined> = {};
	slots: string[] = [];
	teamBuilderImport: string = "";

	dex: typeof Dex;
	roundRequirements: IRoundTeamRequirements;

	constructor(htmlPage: HtmlPageBase, parentCommandPrefix: string, componentCommand: string, props: IBattleEliminationTeambuilderProps) {
		super(htmlPage, parentCommandPrefix, componentCommand, props);

		this.dex = Dex.getDex(props.game.battleFormat.mod);

		this.roundRequirements = {
			additionsThisRound: 0,
			currentTeamLength: 0,
			dropsThisRound: 0,
			evolutionsThisRound: 0,
		};
	}

	tryCommand(originalTargets: readonly string[]): string | undefined {
		const targets = originalTargets.slice();
		const cmd = Tools.toId(targets[0]);
		targets.shift();

		if (cmd === addPokemonCommand) {
			this.addPokemon(targets[0].trim());
		} else if (cmd === dropPokemonCommand) {
			this.dropPokemon(targets[0].trim());
		} else if (cmd === evolvePokemonCommand) {
			this.evolvePokemon(targets[0].trim(), targets[1].trim());
		} else if (cmd === devolvePokemonCommand) {
			this.devolvePokemon(targets[0].trim(), targets[1].trim());
		} else if (cmd === changeRoundCommand) {
			const round = parseInt(targets[0].trim());
			if (!isNaN(round) && round > 1) {
				this.changeRound(round);
				this.props.reRender();
			}
		} else {
			return this.checkComponentCommands(cmd, targets);
		}
	}

	giveStartingTeam(): void {
		const starterPokemon = this.props.game.starterPokemon.get(this.props.player);
		if (!starterPokemon) return;

		this.slots = [];
		for (const name of starterPokemon) {
			const pokemon = this.dex.getExistingPokemon(name);
			this.slots.push(pokemon.name);
		}

		this.setTeamBuilderImport();

		this.roundSlots[1] = this.slots.slice();
		if (this.currentRound > 1) this.setRound(this.currentRound);
	}

	syncRound(): void {
		this.props.game.debugLog(this.props.player.name + " syncRound() at " + this.props.player.round);

		const nextRound = this.currentRound + 1;
		if (this.props.player.round! > nextRound || this.remainingRoundAdditions || this.remainingRoundDrops ||
			this.remainingRoundEvolutions) {
			this.moreRoundsAvailableMessage = "<b>Finish making changes to unlock round " + this.props.player.round + "</b>!";
		} else {
			this.moreRoundsAvailableMessage = "";
			this.setRound(this.props.player.round!);
		}
	}

	nextRound(): void {
		if (this.currentRound === this.props.player.round || this.remainingRoundAdditions || this.remainingRoundDrops ||
			this.remainingRoundEvolutions) return;

		this.currentRound++;

		this.props.game.debugLog(this.props.player.name + " nextRound() going to " + this.currentRound);

		this.setRound(this.currentRound);
	}

	changeRound(round: number): void {
		this.props.game.debugLog(this.props.player.name + " changeRound() to " + round);

		const teamChangesRound = round - 1;
		if (!this.roundSlots[teamChangesRound]) return;

		this.slots = this.roundSlots[teamChangesRound]!.slice();

		for (let i = round; i <= this.props.player.round!; i++) {
			delete this.roundSlots[i];
		}

		this.setTeamBuilderImport();
		this.setRound(round);
	}

	setRound(round: number): void {
		this.currentRound = round;

		const teamChangesRound = this.currentRound - 1;
		if (!this.roundSlots[teamChangesRound]) this.roundSlots[teamChangesRound] = this.slots.slice();

		this.roundRequirements = this.props.game.getRoundTeamRequirements(teamChangesRound);
		this.remainingRoundAdditions = this.roundRequirements.additionsThisRound;
		this.remainingRoundDrops = this.roundRequirements.dropsThisRound;
		this.remainingRoundEvolutions = this.roundRequirements.evolutionsThisRound;

		this.roundDropChoices = this.slots.slice();

		const teamChanges = this.props.game.teamChanges.get(this.props.player) || [];
		const baseTeamChange = teamChanges[teamChangesRound - 1] as ITeamChange | undefined;
		this.roundTeamChange = baseTeamChange ? Tools.deepClone(baseTeamChange) : undefined;

		if (this.roundTeamChange && this.roundTeamChange.choices) {
			const choices = this.roundTeamChange.choices.slice();
			for (const choice of this.roundTeamChange.choices) {
				const pokemon = this.dex.getExistingPokemon(choice);
				const formes = this.dex.getFormes(pokemon);
				for (const forme of formes) {
					if (!choices.includes(forme) && this.props.game.battleFormat.usablePokemon!.includes(forme)) choices.push(forme);
				}
			}

			this.roundTeamChange.choices = choices;
		}

		this.roundEvolvedSlots = [];
		this.availableEvolutions = 0;

		if (this.remainingRoundEvolutions) {
			const devolve = this.remainingRoundEvolutions < 0;
			for (const slot of this.slots) {
				const pokemon = this.dex.getExistingPokemon(slot);
				if (devolve) {
					const prevo = this.dex.getPokemon(pokemon.prevo);
					if (prevo && this.props.game.battleFormat.usablePokemon!.includes(prevo.name)) this.availableEvolutions++;
				} else {
					for (const name of pokemon.evos) {
						const evo = this.dex.getPokemon(name);
						if (evo && this.props.game.battleFormat.usablePokemon!.includes(evo.name)) {
							this.availableEvolutions++;
							break;
						}
					}
				}
			}

			if (this.availableEvolutions < Math.abs(this.remainingRoundEvolutions)) {
				const availableEvolutionsValue = devolve ? -1 * this.availableEvolutions : this.availableEvolutions;
				this.remainingRoundEvolutions = availableEvolutionsValue;
				this.roundRequirements.evolutionsThisRound = availableEvolutionsValue;
			}
		}

		if (this.currentRound === this.props.player.round || (!this.remainingRoundAdditions && !this.remainingRoundDrops &&
			!this.remainingRoundEvolutions)) {
			this.moreRoundsAvailableMessage = "";
		}
	}

	addPokemon(name: string): void {
		if (!this.roundTeamChange || !this.roundTeamChange.choices || !this.roundTeamChange.choices.includes(name) ||
			!this.remainingRoundAdditions || this.slots.length === 6) return;

		const pokemon = this.dex.getPokemon(name);
		if (!pokemon || this.slots.includes(pokemon.name)) return;

		this.slots.push(pokemon.name);
		this.setTeamBuilderImport();

		this.remainingRoundAdditions--;
		if (!this.remainingRoundAdditions && !this.remainingRoundDrops && !this.remainingRoundEvolutions) this.nextRound();

		this.props.reRender();
	}

	dropPokemon(name: string): void {
		if (!this.remainingRoundDrops || this.slots.length === 1 || !this.roundDropChoices.includes(name)) return;

		const index = this.slots.indexOf(name);
		if (index === -1) return;

		this.slots.splice(index, 1);
		this.setTeamBuilderImport();

		this.remainingRoundDrops--;
		if (!this.remainingRoundAdditions && !this.remainingRoundDrops && !this.remainingRoundEvolutions) this.nextRound();

		this.props.reRender();
	}

	evolvePokemon(from: string, to: string): void {
		if (!this.remainingRoundEvolutions || this.roundRequirements.evolutionsThisRound < 0) return;

		const index = this.slots.indexOf(from);
		if (index === -1 || this.roundEvolvedSlots.includes(index)) return;

		const pokemon = this.dex.getPokemon(from);
		if (!pokemon) return;

		for (const name of pokemon.evos) {
			const evo = this.dex.getPokemon(name);
			if (!evo) continue;

			const formes = this.dex.getFormes(evo);
			if (formes.includes(to) && this.props.game.battleFormat.usablePokemon!.includes(to)) {
				this.slots.splice(index, 1, to);
				this.roundEvolvedSlots.push(index);

				this.setTeamBuilderImport();

				this.remainingRoundEvolutions--;
				if (!this.remainingRoundEvolutions) this.nextRound();

				this.props.reRender();
				return;
			}
		}
	}

	devolvePokemon(from: string, to: string): void {
		if (!this.remainingRoundEvolutions || this.roundRequirements.evolutionsThisRound > 0) return;

		const index = this.slots.indexOf(from);
		if (index === -1 || this.roundEvolvedSlots.includes(index)) return;

		const pokemon = this.dex.getPokemon(from);
		if (!pokemon) return;

		const prevo = this.dex.getPokemon(pokemon.prevo);
		if (!prevo) return;

		const formes = this.dex.getFormes(prevo);
		if (formes.includes(to) && this.props.game.battleFormat.usablePokemon!.includes(to)) {
			this.slots.splice(index, 1, to);
			this.roundEvolvedSlots.push(index);

			this.setTeamBuilderImport();

			this.remainingRoundEvolutions++;
			if (!this.remainingRoundEvolutions) this.nextRound();

			this.props.reRender();
		}
	}

	setTeamBuilderImport(): void {
		const teambuilderImports: string[] = [];

		const includeAbilities = this.dex.getGen() >= 3;
		for (const slot of this.slots) {
			const pokemon = this.dex.getPokemon(slot);
			if (!pokemon) continue;

			const ability = includeAbilities ? this.dex.getPokemonUsableAbility(pokemon, this.props.game.battleFormat) : undefined;
			teambuilderImports.push("<br /><code>" + pokemon.name + "<br />Ability: " + (ability || "No Ability") + "</code>");
		}

		this.teamBuilderImport = teambuilderImports.join("<br />");
	}

	renderPokemon(name: string, slot: number): string {
		const pokemon = this.dex.getPokemon(name);
		if (!pokemon) return "";

		let html = Dex.getPokemonIcon(pokemon) + "<b>" + pokemon.name + "</b> | " +
			"<a href='" + this.dex.getPokemonAnalysisLink(pokemon, this.props.game.battleFormat) + "'>Smogon analysis</a>";

		const additionsOrDrops = this.remainingRoundAdditions || this.remainingRoundDrops ? true : false;
		if (additionsOrDrops) {
			if (this.remainingRoundDrops && this.roundDropChoices.includes(name)) {
				html += "<br />";
				html += this.getQuietPmButton(this.commandPrefix + ", " + dropPokemonCommand + ", " + name, "Release");
			}
		}

		if (this.remainingRoundEvolutions && !this.roundEvolvedSlots.includes(slot)) {
			const evolutions: string[] = [];
			if (this.remainingRoundEvolutions > 0 && pokemon.evos.length) {
				html += additionsOrDrops ? "&nbsp;" : "<br />";

				for (const evoName of pokemon.evos) {
					const evo = this.dex.getPokemon(evoName);
					if (!evo) continue;

					const formes = this.dex.getFormes(evo, true);
					for (const forme of formes) {
						if (!evolutions.includes(forme) && this.props.game.battleFormat.usablePokemon!.includes(forme)) {
							html += (evolutions.length ? "&nbsp;" : "") + this.getQuietPmButton(this.commandPrefix + ", " +
								evolvePokemonCommand + ", " + name + ", " + forme, "Evolve into " + forme, {disabled: additionsOrDrops});
							evolutions.push(forme);
						}
					}
				}
			} else if (this.remainingRoundEvolutions < 0 && pokemon.prevo) {
				html += additionsOrDrops ? "&nbsp;" : "<br />";

				const prevo = this.dex.getPokemon(pokemon.prevo);
				if (prevo) {
					const formes = this.dex.getFormes(prevo, true);
					for (const forme of formes) {
						if (!evolutions.includes(forme) && this.props.game.battleFormat.usablePokemon!.includes(forme)) {
							html += (evolutions.length ? "&nbsp;" : "") + this.getQuietPmButton(this.commandPrefix + ", " +
								devolvePokemonCommand + ", " + name + ", " + forme, "De-volve into " + forme, {disabled: additionsOrDrops});
							evolutions.push(forme);
						}
					}
				}
			}
		}

		return html;
	}

	render(): string {
		const starterPokemon = this.props.game.starterPokemon.get(this.props.player);
		if (!starterPokemon || !this.slots.length) return "";

		const changesPerRound = this.props.game.additionsPerRound || this.props.game.dropsPerRound || this.props.game.evolutionsPerRound;

		let html = "";
		if (this.props.game.usesCloakedPokemon) {
			html += "<h3>Your Pokemon to protect in battle</h3>";
			if (!this.props.game.eliminationEnded && starterPokemon.length < 6) {
				html += "You may add any Pokemon to fill your team as long as they are usable in " +
					this.props.game.battleFormat.name + ".";
			}
		} else {
			html += "<h3>Your team" + (changesPerRound ? " and options" : "") + "</h3>";
			if (this.props.game.canReroll && this.props.game.playerCanReroll(this.props.player)) {
				html += "If you are not satisfied with your starting team, you have 1 chance to reroll but you must keep " +
					"whatever you receive! " + Client.getPmSelfButton(Config.commandCharacter + this.props.rerollCommand, "Reroll Pokemon");
				html += "<br /><br />";
			}
		}

		if (!this.props.player.eliminated && !this.props.game.eliminationEnded && this.props.player.round === 2 &&
			this.props.game.firstRoundByes.has(this.props.player)) {
			html += "<b>NOTE</b>: you were given a first round bye so you must follow any team changes below for your first " +
				"battle!<br /><br />";
		}

		const slotsHtml: string[] = [];
		for (let i = 0; i < this.slots.length; i++) {
			slotsHtml.push(this.renderPokemon(this.slots[i], i));
		}

		if (!changesPerRound) {
			html += slotsHtml.join("<br /><br />");
			if (this.teamBuilderImport) {
				html += "<br /><br />Teambuilder import (you may change abilities):<br />";
				html += this.teamBuilderImport;
			}
			return html;
		}

		const roundRequirements: string[] = [];
		if (this.remainingRoundAdditions && this.slots.length < 6 && this.roundTeamChange &&
			this.roundTeamChange.choices && this.roundTeamChange.choices.length) {
			const multiple = this.roundRequirements.additionsThisRound > 1;
			let changeHtml = "<li>choose " + this.remainingRoundAdditions + (multiple ? " more" : "") + " Pokemon to " +
				"add to your team!<br />";
			for (const choice of this.roundTeamChange.choices) {
				const pokemon = this.dex.getExistingPokemon(choice);
				if (this.slots.includes(pokemon.name)) continue;

				changeHtml += this.getQuietPmButton(this.commandPrefix + ", " + addPokemonCommand + ", " + choice,
					Dex.getPokemonIcon(pokemon) + pokemon.name);
			}

			changeHtml += "</li>";
			roundRequirements.push(changeHtml);
		}

		if (this.remainingRoundDrops && this.slots.length > 1) {
			const multiple = this.roundRequirements.dropsThisRound > 1;
			roundRequirements.push("<li>choose " + this.remainingRoundDrops + (multiple ? " more" : "") + " Pokemon " +
				"below to release from your team!</li>");
		}

		if (this.remainingRoundEvolutions && this.availableEvolutions) {
			const multiple = this.roundRequirements.evolutionsThisRound > 1 || this.roundRequirements.evolutionsThisRound < -1;
			roundRequirements.push("<li>choose " + Math.abs(this.remainingRoundEvolutions) + (multiple ? " more" : "") +
				" Pokemon on your team below to " + (this.remainingRoundEvolutions > 0 ? "evolve" : "de-volve") + "!</li>");
		}

		if (this.currentRound > 1) {
			for (let i = this.currentRound; i > 1; i--) {
				if (!this.roundSlots[i - 1]) continue;

				html += this.getQuietPmButton(this.commandPrefix + ", " + changeRoundCommand + ", " + i, "Change round " + i,
					{disabled: i === this.currentRound && ((this.remainingRoundAdditions ||
					this.remainingRoundDrops || this.remainingRoundEvolutions) || (!this.roundRequirements.additionsThisRound &&
					!this.roundRequirements.dropsThisRound && !this.roundRequirements.evolutionsThisRound)) ? true : false}) + "&nbsp;";
			}
			html += "<br /><br />";
		}

		if (this.moreRoundsAvailableMessage) {
			html += this.moreRoundsAvailableMessage + "<br /><br />";
		}

		if (roundRequirements.length) {
			html += "Round " + this.currentRound + " requirements:<br /><ul>" + roundRequirements.join("") + "</ul>";
		}

		html += slotsHtml.join("<br /><br />");

		if (this.teamBuilderImport) {
			html += "<br /><br /><b>Teambuilder import</b> (you may change abilities):<br />";
			html += this.teamBuilderImport;
		}

		return html;
	}
}
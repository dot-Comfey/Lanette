import type { IGameAchievement, IGameCachedData, IGameFile } from "../types/games";
import { game as questionAndAnswerGame, QuestionAndAnswer } from "./templates/question-and-answer";

class AlcremiesWhippedCreameria extends QuestionAndAnswer {
	//static cachedData: IGameCachedData = {};
	static flavors: string[] = ["Caramel Swirl", "Lemon Cream", "Matcha Cream", "Mint Cream", "Rainbow Swirl", 
	"Ruby Cream", "Ruby Swirl", "Salted Cream", "Shiny", "Vanilla Cream"];
	static sweets: string[] = ["Berry", "Clover", "Flower", "Love", "Ribbon", "Star", "Strawberry"];
	roundTime: number = 20 * 1000;

	static loadData(): void {
		//this.cachedData.hintAnswers = {};
		const hintKeys: string[] = [];

		//this.cachedData.hintKeys = hintKeys;
	}

	async customGenerateHint(): Promise<void> {
		let alcremieFlavor = this.sampleOne(AlcremiesWhippedCreameria.flavors);
		let alcremieSweet = this.sampleOne(AlcremiesWhippedCreameria.sweets);
		const answers = [alcremieFlavor + " & " + alcremieSweet];

		this.answers = answers;
		let fileFlavor = "";
		let fileSweet = "";

		if (alcremieFlavor === "Caramel Swirl") fileFlavor = "cs";
		if (alcremieFlavor === "Lemon Cream") fileFlavor = "lc";
		if (alcremieFlavor === "Matcha Cream") fileFlavor = "mac";
		if (alcremieFlavor === "Mint Cream") fileFlavor = "mic";
		if (alcremieFlavor === "Rainbow Swirl") fileFlavor = "ras";
		if (alcremieFlavor === "Ruby Cream") fileFlavor = "rc";
		if (alcremieFlavor === "Ruby Swirl") fileFlavor = "rs";
		if (alcremieFlavor === "Salted Cream") fileFlavor = "sc";

		if (alcremieSweet != "Strawberry") {
			fileSweet = alcremieSweet.toLowerCase();
			if (fileSweet === "love" && alcremieFlavor === "Mint Cream") fileSweet = "heart";
		}

		let imgUrl = "//www.serebii.net/swordshield/pokemon/869-" + fileFlavor + fileSweet + ".png";
		if (!fileFlavor && !fileSweet) imgUrl = "//www.serebii.net/swordshield/pokemon/869.png";
		if (alcremieFlavor === "Shiny") {
			imgUrl = "//www.serebii.net/Shiny/SWSH/869-" + fileSweet + ".png";
			if (!fileSweet) imgUrl = "//www.serebii.net/Shiny/SWSH/869.png";
		}
		
		let hint = "<b>Randomly generated Alcremie</b>:";

		hint += "<br /><center><img src=" + imgUrl + " width=100 height=100></center>";

		this.hint = hint;
	}
}

export const game: IGameFile<AlcremiesWhippedCreameria> = Games.copyTemplateProperties(questionAndAnswerGame, {
	aliases: ["alcremies", "awc", "whippedcreameria"],
	category: 'knowledge-2',
	class: AlcremiesWhippedCreameria,
	defaultOptions: ['points'],
	description: "Players guess the displayed Alcremie form (full name of the flavor is required)!",
	freejoin: true,
	name: "Alcremie's Whipped Creameria",
	mascot: "Alcremie",
	minigameCommand: 'alcremiecream',
	minigameCommandAliases: ['acream'],
	minigameDescription: "Use <code>" + Config.commandCharacter + "g</code> to guess the displayed Alcremie form (full names of the flavor and sweet are required)!",
	modes: ["collectiveteam", "pmtimeattack", "spotlightteam", "survival", "timeattack"],
});

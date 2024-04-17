import { ISavedCustomGridData, ISavedCustomGridCell, ISavedCustomGrids } from "../../types/storage";
import { HexCode } from "../../types/tools";
import type { HtmlPageBase, HtmlSelector } from "../html-page-base";
import { ColorPicker, IColorPick } from "./color-picker";
import type { IComponentProps } from "./component-base";
import { ComponentBase } from "./component-base";
import { NumberTextInput } from "./number-text-input";
import { PokemonChoices, PokemonPickerBase } from "./pokemon-picker-base";
import { PokemonTextInput } from "./pokemon-text-input";
import { ITextInputValidation, TextInput } from "./text-input";

export interface ICustomGridProps extends IComponentProps {
	defaultColor?: HexCode;
	savedCustomGrids?: ISavedCustomGrids;
	showSubmit?: boolean;
	onSubmit: (gridIndex: number, output: string) => void;
}

interface ICellData {
	x: number;
	y: number;
	gridIndex: number;
	color?: HexCode;
	htmlCache?: string;
	label?: string;
	labelColor?: HexCode;
	players?: string[];
	playersColor?: HexCode;
	pokemon?: string;
	pokemonIcon?: string;
	randomPokemon?: boolean;
}

interface IProcessCellUpdateOptions {
	batchUpdate?: boolean;
	colors?: boolean;
	labels?: boolean;
	players?: boolean;
	pokemon?: boolean;
	insert?: boolean;
	erase?: boolean;
	eraseAll?: boolean;
	updateAll?: boolean;
}

const PREVIEW_SELECTOR = 'preview';
const CONTROLS_SELECTOR = 'controls';
const PROPERTIES_SELECTOR = 'properties';

const DEFAULT_WIDTH = 5;
const DEFAULT_HEIGHT = 5;
const DEFAULT_PIXELS = 50;
const EDIT_CELL_PIXEL_SIZE = 50;

const MIN_PIXELS = 5;
const MAX_PIXELS = 100;
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 11;
const MAX_FILL_POKEMON_DIMENSIONS = 11;
const MAX_TOTAL_PIXELS = 580;
const MAX_LABEL_LENGTH = 10;
const HISTORY_LIMIT = 5;
const MAX_GRIDS = 3;
const TEMPORARY_GRID_INDEX = MAX_GRIDS;

const EDIT_CELL_BUTTON_STYLE = 'width: 30px; height: 20px';
const UPDATE_ALL_BUTTON_TEXT = "All";
const UPDATE_ROW_BUTTON_TEXT = "&rarr;";
const UPDATE_COLUMN_BUTTON_TEXT = "&darr;";
const UPDATE_CELL_BUTTON_TEXT = "&check;";

const chooseGridIndexCommand = 'choosegridindex';
const copyToGridIndexCommand = 'copytogridindex';
const chooseColorsView = 'choosecolorsview';
const chooseHomeView = 'choosehomeview';
const choosePokemonView = 'choosepokemonview';
const choosePlayersView = 'chooseplayersview';
const chooseLabelsView = 'chooselabelsview';
const chooseInsertMode = 'chooseinsertmode';
const chooseEraseMode = 'chooseerasemode';
const chooseEraseAllMode = 'chooseeraseallmode';
const setCellColorCommand = 'setcellcolor';
const updateCellCommand = 'updatecell';
const updateColumnCommand = 'updatecolumn';
const updateRowCommand = 'updaterow';
const updateAllCommand = 'updateall';
const setPixelsCommand = 'setpixels';
const setWidthCommand = 'setwidth';
const setHeightCommand = 'setheight';
const setPlayerCommand = 'setplayer';
const setPlayerColorCommand = 'setplayercolor';
const setPokemonCommand = 'setpokemon';
const setLabelCommand = 'setlabel';
const setLabelColorCommand = 'setlabelcolor';
const allowDuplicatePokemonCommand = 'allowduplicatepokemon';
const disallowDuplicatePokemonCommand = 'disallowduplicatepokemon';
const randomPokemonCommand = 'randompokemon';
const fillRandomPokemonCommand = 'fillrandompokemon';
const choosePokemon = 'choosepokemon';
const choosePlayer = 'chooseplayer';
const undoCommand = 'undo';
const redoCommand = 'redo';
const resetCommand = 'reset';
const submitCommand = 'submit';

const PLAYER_SYMBOL = "P";

export class CustomGrid extends ComponentBase<ICustomGridProps> {
	componentId: string = 'custom-grid';

	allowDuplicatePokemon: boolean[] = [];
	currentGridIndex: number = 0;
	currentView: 'colors' | 'pokemon' | 'players' | 'labels' | 'home' = 'home';
	currentMode: 'insert' | 'erase' | 'eraseall' = 'insert';
	currentPlayer: string = "";
	currentPokemon: string = "";
	currentPokemonIcon: string = "";
	currentLabel: string = "";
	/**grid index -> filter error */
	filterError: string[] = [];
	/**grid index -> grid */
	grids: ICellData[][][] = [];
	gridHtml: string = "";
	/**grid index -> x */
	height: number[] = [];
	/**grid index -> pixel size */
	pixelSize: number[] = [];
	/**grid index -> player locations */
	playerLocations: Dict<ICellData>[] = [];
	/**grid index -> pokemon names */
	pokemonNames: Dict<string>[] = [];
	/**grid index -> pokemon icon locations */
	pokemonIconLocations: Dict<ICellData>[] = [];
	roomViewGridHtml: string = "";
	/**grid index -> redos available */
	redosAvailable: number[] = [];
	/**grid index -> redos -> grid */
	redoGrids: ICellData[][][][] = [];
	/**grid index -> redos -> saved grid */
	redoSavedGrids: ISavedCustomGridCell[][][][] = [];
	/**grid index -> undos available */
	undosAvailable: number[] = [];
	/**grid index -> undos -> grid */
	undoGrids: ICellData[][][][] = [];
	/**grid index -> undos -> saved grid */
	undoSavedGrids: ISavedCustomGridCell[][][][] = [];
	usesHtmlSelectors: boolean = true;
	/**grid index -> y */
	width: number[] = [];

	controlsSelector: HtmlSelector;
	currentCellColor: HexCode | undefined;
	currentLabelColor: HexCode | undefined;
	currentPlayerColor: HexCode | undefined;
	cellColorPicker: ColorPicker;
	defaultColor: HexCode;
	labelInput: TextInput;
	labelColorPicker: ColorPicker;
	maxDimensions!: number;
	minPokemonIconPixelSize: number;
	playerPicker: NumberTextInput;
	playerColorPicker: ColorPicker;
	pokemonPicker: PokemonTextInput;
	pokemonList: string[];
	previewSelector: HtmlSelector;
	propertiesSelector: HtmlSelector;

	constructor(htmlPage: HtmlPageBase, parentCommandPrefix: string, componentCommand: string, props: ICustomGridProps) {
		super(htmlPage, parentCommandPrefix, componentCommand, props);

		this.previewSelector = this.newSelector(PREVIEW_SELECTOR);
		this.controlsSelector = this.newSelector(CONTROLS_SELECTOR);
		this.propertiesSelector = this.newSelector(PROPERTIES_SELECTOR);
		this.addSelector(this.previewSelector);
		this.addSelector(this.controlsSelector);
		this.addSelector(this.propertiesSelector);

		this.defaultColor = props.defaultColor || Tools.getWhiteHexCode();
		this.minPokemonIconPixelSize = Dex.getPokemonIconWidth();

		PokemonPickerBase.loadData();
		const includedPokemonNumbers: number[] = [];
		this.pokemonList = PokemonPickerBase.pokemonGens[Dex.getModelGenerations().slice().pop()!].slice()
			.filter(x => {
				const pokemon = Dex.getExistingPokemon(x);
				if (pokemon.num > 0 && !includedPokemonNumbers.includes(pokemon.num)) {
					includedPokemonNumbers.push(pokemon.num);
					return true;
				}
				return false;
			});

		// initialize grid lists
		for (let i = 0; i <= TEMPORARY_GRID_INDEX; i++) {
			this.allowDuplicatePokemon.push(false);
			this.filterError.push("");
			this.playerLocations.push({});
			this.pokemonNames.push({});
			this.pokemonIconLocations.push({});
			this.grids.push([]);
			this.redoGrids.push([]);
			this.redoSavedGrids.push([]);
			this.undoGrids.push([]);
			this.undoSavedGrids.push([]);

			this.redosAvailable.push(0);
			this.undosAvailable.push(0);
			this.height.push(DEFAULT_HEIGHT);
			this.pixelSize.push(DEFAULT_PIXELS);
			this.width.push(DEFAULT_WIDTH);
		}

		// initialize saved grids + temp grid with defaults
		for (let i = TEMPORARY_GRID_INDEX; i >= 0; i--) {
			// account for scenarios like only grids 1 & 3 being set
			if (this.props.savedCustomGrids && this.props.savedCustomGrids.grids[i]) {
				this.height[i] = this.props.savedCustomGrids.grids[i].height;
				this.pixelSize[i] = this.props.savedCustomGrids.grids[i].pixelSize;
				this.width[i] = this.props.savedCustomGrids.grids[i].width;

				this.updateGridDimensions(i, true);

				if (this.props.savedCustomGrids.grids[i].allowDuplicatePokemon) {
					this.allowDuplicatePokemon[i] = this.props.savedCustomGrids.grids[i].allowDuplicatePokemon!;
				}

				this.loadSavedGridCells(i, this.props.savedCustomGrids.grids[i]);

				this.checkPokemonIconCount(i);
			} else {
				this.updateGridDimensions(i);
			}

			// initialize cell caches after saved or default grid is loaded
			const grid = this.getGrid(i);
			for (const row of grid) {
				for (const cell of row) {
					this.updateCellCaches(cell);
				}
			}
		}

		this.updateGridHtml();

		// sub-components
		this.cellColorPicker = new ColorPicker(htmlPage, this.commandPrefix, setCellColorCommand, {
			name: "Current color",
			autoSubmitCustomInput: true,
			defaultView: 'preselected',
			hidePreview: true,
			onlyCustomPrimary: true,
			onPickHueVariation: (index, hueVariation, dontRender) => this.pickColorHueVariation(dontRender),
			onPickLightness: (index, lightness, dontRender) => this.pickColorLightness(dontRender),
			onClear: (index, dontRender) => this.clearCellColor(dontRender),
			onPick: (index, color, dontRender) => this.setCellColor(color, dontRender),
			readonly: this.props.readonly,
			reRender: () => this.send(),
		});

		this.playerPicker = new NumberTextInput(htmlPage, this.commandPrefix, setPlayerCommand, {
			min: 1,
			max: 20,
			name: "Player",
			label: "Enter player number",
			onClear: () => this.clearPlayer(),
			onErrors: () => this.send(),
			onSubmit: (output) => this.setPlayer(PLAYER_SYMBOL + output),
			reRender: () => this.send(),
		});

		this.playerColorPicker = new ColorPicker(htmlPage, this.commandPrefix, setPlayerColorCommand, {
			name: "Current player color",
			autoSubmitCustomInput: true,
			defaultView: 'preselected',
			hidePreview: true,
			onlyCustomPrimary: true,
			onPickHueVariation: (index, hueVariation, dontRender) => this.pickColorHueVariation(dontRender),
			onPickLightness: (index, lightness, dontRender) => this.pickColorLightness(dontRender),
			onClear: (index, dontRender) => this.clearPlayerColor(dontRender),
			onPick: (index, color, dontRender) => this.setPlayerColor(color, dontRender),
			readonly: this.props.readonly,
			reRender: () => this.send(),
		});

		this.pokemonPicker = new PokemonTextInput(htmlPage, this.commandPrefix, setPokemonCommand, {
			inputWidth: Tools.minRoomWidth,
			minPokemon: 1,
			maxPokemon: 1,
			name: "Pokemon icon",
			placeholder: "Enter a Pokemon",
			pokemonList: this.pokemonList,
			clearText: "Clear",
			submitText: "Update",
			onClear: () => this.clearPokemon(),
			onSubmit: (output) => this.setPokemon(output),
			reRender: () => this.send(),
		});

		this.labelInput = new TextInput(htmlPage, this.commandPrefix, setLabelCommand, {
			label: "Enter label",
			name: "Label",
			validateSubmission: (input): ITextInputValidation => {
				input = input.trim();
				if (input.length > MAX_LABEL_LENGTH) {
					return {errors: ["Labels cannot be longer than " + MAX_LABEL_LENGTH + " characters"]};
				}

				if (input in this.playerLocations[this.currentGridIndex]) {
					return {errors: ["Labels cannot be the same as an existing player marker"]};
				}

				if (Client.checkFilters(input, this.htmlPage.room)) {
					return {errors: ["The specified label contains a banned word"]};
				}

				return {currentOutput: input};
			},
			onClear: () => this.clearLabel(),
			onErrors: () => this.send(),
			onSubmit: (output) => this.setLabel(output),
			reRender: () => this.send(),
		});

		this.labelColorPicker = new ColorPicker(htmlPage, this.commandPrefix, setLabelColorCommand, {
			name: "Current label color",
			autoSubmitCustomInput: true,
			defaultView: 'preselected',
			hidePreview: true,
			onlyCustomPrimary: true,
			onPickHueVariation: (index, hueVariation, dontRender) => this.pickColorHueVariation(dontRender),
			onPickLightness: (index, lightness, dontRender) => this.pickColorLightness(dontRender),
			onClear: (index, dontRender) => this.clearLabelColor(dontRender),
			onPick: (index, color, dontRender) => this.setLabelColor(color, dontRender),
			readonly: this.props.readonly,
			reRender: () => this.send(),
		});

		this.components = [this.cellColorPicker, this.playerPicker, this.playerColorPicker, this.pokemonPicker, this.labelInput,
			this.labelColorPicker];

		this.toggleActiveComponents();
	}

	/**
	 * sub-component methods
	 */

	pickColorHueVariation(dontRender?: boolean): void {
		if (!dontRender) this.send();
	}

	pickColorLightness(dontRender?: boolean): void {
		if (!dontRender) this.send();
	}

	clearCellColor(dontRender?: boolean): void {
		this.currentCellColor = undefined;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	setCellColor(color: IColorPick, dontRender?: boolean): void {
		this.currentCellColor = color.hexCode;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	clearLabelColor(dontRender?: boolean): void {
		this.currentLabelColor = undefined;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	setLabelColor(color: IColorPick, dontRender?: boolean): void {
		this.currentLabelColor = color.hexCode;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	clearPlayerColor(dontRender?: boolean): void {
		this.currentPlayerColor = undefined;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	setPlayerColor(color: IColorPick, dontRender?: boolean): void {
		this.currentPlayerColor = color.hexCode;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	clearPlayer(dontRender?: boolean): void {
		this.currentPlayer = "";

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	setPlayer(player: string, dontRender?: boolean): void {
		this.currentPlayer = player;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	clearPokemon(dontRender?: boolean): void {
		this.currentPokemonIcon = "";

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	setPokemon(choices: PokemonChoices): void {
		this.choosePokemon(choices[0]!.pokemon);
	}

	choosePokemon(species: string): void {
		const pokemon = Dex.getExistingPokemon(species);
		this.currentPokemon = pokemon.name;
		this.currentPokemonIcon = Dex.getPokemonIcon(pokemon);

		this.cellColorPicker.parentSetPokemon(pokemon.name);
		this.updateGridHtml(true);
		this.send();
	}

	clearLabel(dontRender?: boolean): void {
		this.currentLabel = "";

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	setLabel(label: string, dontRender?: boolean): void {
		this.currentLabel = label;

		if (!dontRender) {
			this.updateGridHtml(true);
			this.send();
		}
	}

	/**
	 * navidation and modes
	 */

	setCurrentGridIndex(index: number): void {
		if (index === this.currentGridIndex) return;

		this.currentGridIndex = index;
		this.updateGridHtml();
		this.send();
	}

	copyCurrentGridToIndex(index: number): void {
		if (index === this.currentGridIndex) return;

		this.grids[index] = this.cloneGrid(this.grids[this.currentGridIndex], index);

		if (this.props.savedCustomGrids && this.props.savedCustomGrids.grids[this.currentGridIndex] &&
			index !== TEMPORARY_GRID_INDEX) {
			const savedGrids = this.props.savedCustomGrids.grids;
			savedGrids[index] = {
				grid: this.cloneSavedGrid(savedGrids[this.currentGridIndex].grid),
				allowDuplicatePokemon: savedGrids[this.currentGridIndex].allowDuplicatePokemon,
				height: savedGrids[this.currentGridIndex].height,
				pixelSize: savedGrids[this.currentGridIndex].pixelSize,
				width: savedGrids[this.currentGridIndex].width,
			};
		}
	}

	chooseHomeView(): void {
		if (this.currentView === 'home') return;

		this.currentView = 'home';

		this.toggleActiveComponents();
		this.updateGridHtml(true);
		this.send();
	}

	chooseColorsView(): void {
		if (this.currentView === 'colors') return;

		this.currentView = 'colors';

		this.toggleActiveComponents();
		this.updateGridHtml(true);
		this.send();
	}

	choosePlayersView(): void {
		if (this.currentView === 'players') return;

		this.currentView = 'players';

		this.toggleActiveComponents();
		this.updateGridHtml(true);
		this.send();
	}

	choosePokemonView(): void {
		if (this.currentView === 'pokemon') return;

		this.currentView = 'pokemon';

		this.toggleActiveComponents();
		this.updateGridHtml(true);
		this.send();
	}

	chooseLabelsView(): void {
		if (this.currentView === 'labels') return;

		this.currentView = 'labels';

		this.toggleActiveComponents();
		this.updateGridHtml(true);
		this.send();
	}

	toggleActiveComponents(): void {
		this.cellColorPicker.active = this.currentView === 'colors';
		this.pokemonPicker.active = this.currentView === 'pokemon';

		const players = this.currentView === 'players';
		this.playerPicker.active = players;
		this.playerColorPicker.active = players;

		const labels = this.currentView === 'labels';
		this.labelInput.active = labels;
		this.labelColorPicker.active = labels;
	}

	chooseInsertMode(): void {
		if (this.currentMode === 'insert') return;

		this.currentMode = 'insert';
		this.updateGridHtml(true);
		this.send();
	}

	chooseEraseMode(): void {
		if (this.currentMode === 'erase') return;

		this.currentMode = 'erase';
		this.updateGridHtml(true);
		this.send();
	}

	chooseEraseAllMode(): void {
		if (this.currentMode === 'eraseall') return;

		this.currentMode = 'eraseall';
		this.updateGridHtml(true);
		this.send();
	}

	/**
	 * cell methods
	 */

	createCell(index: number, x: number, y: number, loadingSavedGrid?: boolean): ICellData {
		const cell: ICellData = {
			gridIndex: index,
			x,
			y,
		};

		// avoid clearing a saved grid when setting dimensions on open
		if (!loadingSavedGrid) {
			this.updateCellCaches(cell);
		}

		return cell;
	}

	clearCell(cell: ICellData, updateAll?: boolean): boolean {
		this.eraseColor(cell);
		this.erasePokemon(cell);

		if (cell.players) {
			const players = cell.players.slice();
			for (const player of players) {
				this.erasePlayer(cell, player);
			}
		}

		return this.eraseLabel(cell, updateAll);
	}

	updateCellCaches(cell: ICellData): void {
		// cache html for preview
		let html = '<td style="position: relative;background: ' + (cell.color || this.defaultColor) + '">';

		let hasPlayers = false;
		if (cell.players) {
			const players = cell.players.length;
			if (players) {
				hasPlayers = true;

				if (cell.playersColor) html += "<span style='color: " + cell.playersColor + "'>";
				if (players > 1) {
					html += "<span title='" + cell.players.join(", ") + "'>*</span>";
				} else {
					html += cell.players[0];
				}
				if (cell.playersColor) html += "</span>";
			}
		}

		if (cell.label) {
			if (hasPlayers) html += "<br />";
			if (cell.labelColor) html += "<span style='color: " + cell.labelColor + "'>";
			html += cell.label;
			if (cell.labelColor) html += "</span>";
		}

		if (cell.pokemonIcon) {
			if (hasPlayers || cell.label) html += "<br />";
			html += cell.pokemonIcon;
		}

		html += '</td>';

		cell.htmlCache = html;

		// update saved grid cell when cache is invalidated
		const savedGrid = this.getSavedGrid(cell.gridIndex);
		if (savedGrid) {
			const savedCell = savedGrid.grid[cell.x][cell.y];
			savedCell.color = cell.color;
			savedCell.label = cell.label;
			savedCell.labelColor = cell.labelColor;
			savedCell.pokemon = cell.pokemon;
			savedCell.randomPokemon = cell.randomPokemon;
		}
	}

	insertColor(cell: ICellData, color: HexCode | undefined): void {
		cell.color = color;
	}

	eraseColor(cell: ICellData): void {
		cell.color = undefined;
	}

	/**Returns `false` if inserting triggers a filter */
	insertLabel(cell: ICellData, label: string, labelColor: HexCode | undefined): boolean {
		const previousValue = cell.label;
		cell.label = label;
		if (this.checkFilters(cell.gridIndex)) {
			cell.label = previousValue;
			return false;
		} else {
			if (labelColor) cell.labelColor = labelColor;
			return true;
		}
	}

	/**Returns `false` if erasing triggers a filter */
	eraseLabel(cell: ICellData, updateAll?: boolean): boolean {
		const previousValue = cell.label;
		cell.label = undefined;
		if (!updateAll && this.checkFilters(cell.gridIndex)) {
			cell.label = previousValue;
			return false;
		} else {
			cell.labelColor = undefined;
			return true;
		}
	}

	insertPokemon(cell: ICellData, pokemon: string, pokemonIcon: string, batchUpdate?: boolean): void {
		if (cell.pokemonIcon && cell.pokemonIcon !== pokemonIcon) {
			if (!this.allowDuplicatePokemon[cell.gridIndex]) delete this.pokemonNames[cell.gridIndex][cell.pokemonIcon];
			delete this.pokemonIconLocations[cell.gridIndex][cell.pokemonIcon];
		}

		if (!this.allowDuplicatePokemon[cell.gridIndex] && pokemonIcon in this.pokemonIconLocations[cell.gridIndex]) {
			const previousCell = this.pokemonIconLocations[cell.gridIndex][pokemonIcon];
			this.erasePokemon(previousCell);
			this.updateCellCaches(previousCell);
		}

		cell.pokemon = pokemon;
		cell.pokemonIcon = pokemonIcon;
		this.pokemonIconLocations[cell.gridIndex][pokemonIcon] = cell;
		this.pokemonNames[cell.gridIndex][pokemonIcon] = pokemon;

		if (!batchUpdate) this.checkPokemonIconCount(cell.gridIndex);
	}

	erasePokemon(cell: ICellData): void {
		if (cell.pokemonIcon) {
			if (!this.allowDuplicatePokemon[cell.gridIndex]) delete this.pokemonNames[cell.gridIndex][cell.pokemonIcon];
			delete this.pokemonIconLocations[cell.gridIndex][cell.pokemonIcon];
			cell.pokemonIcon = undefined;
		}

		cell.pokemon = undefined;
		cell.randomPokemon = undefined;
	}

	insertPlayer(cell: ICellData, player: string): void {
		if (player in this.playerLocations[cell.gridIndex]) {
			const previousCell = this.playerLocations[cell.gridIndex][player];
			this.erasePlayer(this.playerLocations[cell.gridIndex][player], player);

			this.updateCellCaches(previousCell);
		}

		if (!cell.players) cell.players = [];
		if (!cell.players.includes(player)) cell.players.push(player);
		this.playerLocations[cell.gridIndex][player] = cell;

		if (this.currentPlayerColor) cell.playersColor = this.currentPlayerColor;
	}

	erasePlayer(cell: ICellData, player: string): void {
		if (cell.players) {
			const index = cell.players.indexOf(player);
			if (index !== -1) {
				cell.players.splice(index, 1);
				if (!cell.players.length) {
					cell.players = undefined;
					cell.playersColor = undefined;
				}
			}

			delete this.playerLocations[cell.gridIndex][player];
		}
	}

	getProcessCellUpdateOptions(batchUpdate?: boolean, updateAll?: boolean): IProcessCellUpdateOptions {
		return {
			batchUpdate,
			colors: this.currentView === 'colors',
			labels: this.currentView === 'labels',
			players: this.currentView === 'players',
			pokemon: this.currentView === 'pokemon',
			insert: this.currentMode === 'insert',
			erase: this.currentMode === 'erase',
			eraseAll: this.currentMode === 'eraseall',
			updateAll,
		};
	}

	canProcessCellUpdate(gridIndex: number, options: IProcessCellUpdateOptions): boolean {
		if (options.erase || options.eraseAll) return true;

		if ((options.players && options.batchUpdate) || (options.colors && !this.currentCellColor) ||
			(options.labels && !this.currentLabel) ||
			(options.pokemon &&
				(!this.currentPokemonIcon || (options.batchUpdate && !this.allowDuplicatePokemon[gridIndex])))) return false;

		return true;
	}

	/**Returns `false` if a batch update should stop, e.g. a label triggers a filter */
	processCellUpdate(index: number, x: number, y: number, options: IProcessCellUpdateOptions): boolean {
		const grid = this.getGrid(index);
		const cell = grid[x][y];
		if (options.eraseAll) {
			if (!this.clearCell(cell, options.updateAll)) {
				this.updateCellCaches(cell);
				return false;
			}
		} else {
			if (options.colors) {
				if (options.erase) {
					this.eraseColor(cell);
				} else {
					this.insertColor(cell, this.currentCellColor);
				}
			} else if (options.labels) {
				if (options.erase) {
					if (!this.eraseLabel(cell)) {
						this.updateCellCaches(cell);
						return false;
					}
				} else {
					if (!this.insertLabel(cell, this.currentLabel, this.currentLabelColor)) {
						this.updateCellCaches(cell);
						return false;
					}
				}
			} else if (options.players) {
				if (options.erase) {
					this.erasePlayer(cell, this.currentPlayer);
				} else {
					this.insertPlayer(cell, this.currentPlayer);
				}
			} else if (options.pokemon) {
				if (options.erase) {
					this.erasePokemon(cell);
				} else {
					this.insertPokemon(cell, this.currentPokemon, this.currentPokemonIcon);
				}
			}
		}

		this.updateCellCaches(cell);

		return true;
	}

	updateCell(inputX: string | undefined, inputY: string | undefined): void {
		if (!inputX || !inputY || this.currentView === 'home') return;

		const x = parseInt(inputX.trim());
		const y = parseInt(inputY.trim());
		if (isNaN(x) || isNaN(y) || x < 0 || y < 0 || x > this.height[this.currentGridIndex] || y > this.width[this.currentGridIndex]) {
			return;
		}

		const options = this.getProcessCellUpdateOptions();
		if (!this.canProcessCellUpdate(this.currentGridIndex, options)) return;

		this.prepareUndo(true);
		this.processCellUpdate(this.currentGridIndex, x, y, options);

		this.updateGridHtml();
		this.send();
	}

	updateColumn(inputColumn: string | undefined): void {
		if (!inputColumn || this.currentView === 'home') return;

		const column = parseInt(inputColumn.trim());
		if (isNaN(column) || column < 0 || column > this.width[this.currentGridIndex]) return;

		const options = this.getProcessCellUpdateOptions(true);
		if (!this.canProcessCellUpdate(this.currentGridIndex, options)) return;

		this.prepareUndo(true);

		for (let x = 0; x < this.height[this.currentGridIndex]; x++) {
			if (!this.processCellUpdate(this.currentGridIndex, x, column, options)) break;
		}

		if (options.pokemon && !options.erase && !options.eraseAll) this.checkPokemonIconCount(this.currentGridIndex);

		this.updateGridHtml();
		this.send();
	}

	updateRow(inputRow: string | undefined): void {
		if (!inputRow || this.currentView === 'home') return;

		const row = parseInt(inputRow.trim());
		if (isNaN(row) || row < 0 || row > this.height[this.currentGridIndex]) return;

		const options = this.getProcessCellUpdateOptions(true);
		if (!this.canProcessCellUpdate(this.currentGridIndex, options)) return;

		this.prepareUndo(true);

		for (let y = 0; y < this.width[this.currentGridIndex]; y++) {
			if (!this.processCellUpdate(this.currentGridIndex, row, y, options)) break;
		}

		if (options.pokemon && !options.erase && !options.eraseAll) this.checkPokemonIconCount(this.currentGridIndex);

		this.updateGridHtml();
		this.send();
	}

	updateAll(): void {
		if (this.currentView === 'home') return;

		const options = this.getProcessCellUpdateOptions(true, true);
		if (!this.canProcessCellUpdate(this.currentGridIndex, options)) return;

		this.prepareUndo(true);

		const grid = this.getGrid(this.currentGridIndex);

		outer:
		for (let x = 0; x < grid.length; x++) {
			for (let y = 0; y < grid[x].length; y++) {
				if (!this.processCellUpdate(this.currentGridIndex, x, y, options)) break outer;
			}
		}

		if (options.pokemon && !options.erase && !options.eraseAll) this.checkPokemonIconCount(this.currentGridIndex);

		this.updateGridHtml();
		this.send();
	}

	/**
	 * grid methods
	 */

	getGrid(index: number): ICellData[][] {
		return this.grids[index];
	}

	getSavedGrid(index: number): ISavedCustomGridData | undefined {
		if (!this.props.savedCustomGrids || index === TEMPORARY_GRID_INDEX) return;

		if (!this.props.savedCustomGrids.grids[index]) {
			this.props.savedCustomGrids.grids[index] = {
				grid: [],
				height: this.height[index],
				pixelSize: this.pixelSize[index],
				width: this.width[index],
			}
		}

		return this.props.savedCustomGrids.grids[index];
	}

	loadSavedGridCells(index: number, savedGrid: ISavedCustomGridData): void {
		const grid = this.getGrid(index);
		for (let x = 0; x < savedGrid.grid.length; x++) {
			// the max width may have changed
			if (!grid[x]) break;

			const savedRow = savedGrid.grid[x];
			for (let y = 0; y < savedRow.length; y++) {
				// the max height may have changed
				if (!grid[x][y]) break;

				const savedCell = savedRow[y];
				const cell = grid[x][y];
				if (savedCell.color) this.insertColor(cell, savedCell.color);
				if (savedCell.label) {
					if (!this.insertLabel(cell, savedCell.label, savedCell.labelColor)) {
						savedCell.label = undefined;
						savedCell.labelColor = undefined;
					}
				}

				if (savedCell.pokemon) {
					const pokemon = Dex.getPokemon(savedCell.pokemon);
					if (pokemon && this.pokemonList.includes(pokemon.name)) {
						this.insertPokemon(cell, pokemon.name, Dex.getPokemonIcon(pokemon));
						cell.randomPokemon = savedCell.randomPokemon;
					}
				}
			}
		}

		// check filters again in case any saved labels were skipped
		if (this.checkFilters(index)) {
			for (let x = 0; x < grid.length; x++) {
				for (let y = 0; y < grid[x].length; y++) {
					grid[x][y].label = undefined;
					grid[x][y].labelColor = undefined;

					savedGrid.grid[x][y].label = undefined;
					savedGrid.grid[x][y].labelColor = undefined;
				}
			}
		}
	}

	updateGridDimensions(index?: number, loadingSavedGrid?: boolean): void {
		if (index === undefined) index = this.currentGridIndex;

		const grid = this.getGrid(index);
		const savedGrid = this.getSavedGrid(index);

		this.maxDimensions = Math.floor(MAX_TOTAL_PIXELS / this.pixelSize[index]);
		// limit size of sent HTML
		if (this.maxDimensions > MAX_DIMENSION) this.maxDimensions = MAX_DIMENSION;

		if (this.width[index] > this.maxDimensions) this.width[index] = this.maxDimensions;
		if (this.height[index] > this.maxDimensions) this.height[index] = this.maxDimensions;

		const height = grid.length;
		if (height > this.height[index]) {
			for (let x = this.height[index]; x < height; x++) {
				for (let y = 0; y < this.width[index]; y++) {
					this.clearCell(grid[x][y]);
				}
			}

			this.grids[index] = grid.slice(0, this.height[index]);
		} else if (height < this.height[index]) {
			for (let x = height; x < this.height[index]; x++) {
				grid.push([]);
			}
		}

		if (savedGrid) {
			const currentGridHeight = grid.length;
			const savedGridHeight = savedGrid.grid.length;
			if (savedGridHeight > currentGridHeight) {
				savedGrid.grid = savedGrid.grid.slice(0, currentGridHeight);
			} else if (savedGridHeight < currentGridHeight) {
				for (let x = savedGridHeight; x < currentGridHeight; x++) {
					savedGrid.grid.push([]);
				}
			}
		}

		for (let x = 0; x < grid.length; x++) {
			// create saved grid cells first to avoid error while updating caches
			if (savedGrid) {
				const savedRowWidth = savedGrid.grid[x].length;
				if (savedRowWidth > this.width[index]) {
					savedGrid.grid[x] = savedGrid.grid[x].slice(0, this.width[index]);
				} else if (savedRowWidth < this.width[index]) {
					for (let y = savedRowWidth; y < this.width[index]; y++) {
						savedGrid.grid[x].push({});
					}
				}
			}

			const rowWidth = grid[x].length;
			if (rowWidth > this.width[index]) {
				for (let y = this.width[index]; y < rowWidth; y++) {
					this.clearCell(grid[x][y]);
				}

				this.grids[index][x] = grid[x].slice(0, this.width[index]);
			} else if (rowWidth < this.width[index]) {
				for (let y = rowWidth; y < this.width[index]; y++) {
					grid[x].push(this.createCell(index, x, y, loadingSavedGrid));
				}
			}
		}
	}

	updateWidth(width: number): void {
		if (width === this.width[this.currentGridIndex]) return;

		this.width[this.currentGridIndex] = width;
		this.updateGridDimensions();

		const savedGrid = this.getSavedGrid(this.currentGridIndex);
		if (savedGrid) savedGrid.width = width;
	}

	updateHeight(height: number): void {
		if (height === this.height[this.currentGridIndex]) return;

		this.height[this.currentGridIndex] = height;
		this.updateGridDimensions();

		const savedGrid = this.getSavedGrid(this.currentGridIndex);
		if (savedGrid) savedGrid.height = height;
	}

	updatePixelSize(pixels: number): void {
		if (pixels === this.pixelSize[this.currentGridIndex]) return;

		this.pixelSize[this.currentGridIndex] = pixels;
		this.updateGridDimensions();

		const savedGrid = this.getSavedGrid(this.currentGridIndex);
		if (savedGrid) savedGrid.pixelSize = pixels;
	}

	/**Update the pixel size of the grid if it is too small for icons */
	checkPokemonIconCount(index: number): void {
		const grid = this.getGrid(index);
		for (const row of grid) {
			for (const cell of row) {
				if (cell.pokemonIcon) {
					if (this.pixelSize[index] < this.minPokemonIconPixelSize) {
						this.updatePixelSize(this.minPokemonIconPixelSize);
					}

					return;
				}
			}
		}
	}

	getGridHtml(roomView?: boolean): string {
		let width = this.width[this.currentGridIndex];
		if (roomView) {
			width += 1;
		}

		const totalWidth = width * (roomView ? this.pixelSize[this.currentGridIndex] : EDIT_CELL_PIXEL_SIZE);
		const rowHeight = roomView ? this.pixelSize[this.currentGridIndex] : EDIT_CELL_PIXEL_SIZE;
		let html = '<table align="center" border="1" ' +
			'style="color: black;font-weight: bold;text-align: center;table-layout: fixed;border-spacing: 1px;' +
				'width: ' + totalWidth + 'px;">';

		const colors = this.currentView === 'colors';
		const players = this.currentView === 'players';
		const pokemon = this.currentView === 'pokemon';
		const labels = this.currentView === 'labels';
		const home = this.currentView === 'home';

		const clear = this.currentMode === 'erase' || this.currentMode === 'eraseall';

		const disableFills = home || (!clear && players) || (!clear && colors && !this.currentCellColor) ||
			(!clear && labels && !this.currentLabel) || (!clear && pokemon && !this.allowDuplicatePokemon[this.currentGridIndex]);

		let disableAllCells = home;
		if (!clear && !home) {
			if (colors) {
				disableAllCells = !this.currentCellColor;
			} else if (players) {
				disableAllCells = !this.currentPlayer;
			} else if (pokemon) {
				disableAllCells = !this.currentPokemonIcon;
			} else if (labels) {
				disableAllCells = !this.currentLabel;
			}
		}

		const batchEditBackground = Tools.getBlackHexCode();
		// update all cells or entire column
		if (!roomView) {
			html += '<tr style="height:' + rowHeight + 'px">';
			for (let i = 0; i <= this.width[this.currentGridIndex]; i++) {
				if (i === 0) {
					html += '<td style="position: relative;background: ' + batchEditBackground + '">';
					html += this.getQuietPmButton(this.commandPrefix + ", " + updateAllCommand, UPDATE_ALL_BUTTON_TEXT,
						{disabled: disableFills, style: EDIT_CELL_BUTTON_STYLE});
					html += '</td>';
				} else {
					html += '<td style="position: relative;background: ' + batchEditBackground + '">';
					html += this.getQuietPmButton(this.commandPrefix + ", " + updateColumnCommand + ", " + (i - 1),
						UPDATE_COLUMN_BUTTON_TEXT, {disabled: disableFills, style: EDIT_CELL_BUTTON_STYLE});
					html += '</td>';
				}
			}
			html += '</tr>';
		}

		const grid = this.getGrid(this.currentGridIndex);
		for (let x = 0; x < grid.length; x++) {
			html += '<tr style="height:' + rowHeight + 'px">';

			// update entire row
			if (!roomView) {
				html += '<td style="position: relative;background: ' + batchEditBackground + '">';
				html += this.getQuietPmButton(this.commandPrefix + ", " + updateRowCommand + ", " + x, UPDATE_ROW_BUTTON_TEXT,
					{disabled: disableFills, style: EDIT_CELL_BUTTON_STYLE});
				html += '</td>';
			}

			const row = grid[x];
			for (let y = 0; y < row.length; y++) {
				if (roomView) {
					html += row[y].htmlCache;
				} else {
					html += '<td style="position: relative;background: ' + (row[y].color || this.defaultColor) + '">';

					let hasPlayers = false;
					if (row[y].players) {
						const players = row[y].players!.length;
						if (players) {
							hasPlayers = true;
							if (row[y].playersColor) html += "<span style='color: " + row[y].playersColor + "'>";
							if (players > 1) {
								html += "<span title='" + row[y].players!.join(", ") + "'>*</span>";
							} else {
								html += row[y].players![0];
							}
							if (row[y].playersColor) html += "</span>";
						}
					}

					if (row[y].label) {
						if (hasPlayers) html += "<br />";
						if (row[y].labelColor) html += "<span style='color: " + row[y].labelColor + "'>";
						html += row[y].label;
						if (row[y].labelColor) html += "</span>";
					}

					if (row[y].pokemonIcon) {
						if (hasPlayers || row[y].label) html += "<br />";
						html += row[y].pokemonIcon;
					}

					let disableCell = false;
					if (clear && !disableAllCells) {
						if (colors) {
							if (!row[y].color) disableCell = true;
						} else if (pokemon) {
							if (!row[y].pokemonIcon) disableCell = true;
						} else if (players) {
							if (!row[y].players || !row[y].players!.includes(this.currentPlayer)) disableCell = true;
						} else if (labels) {
							if (!row[y].label) disableCell = true;
						}
					}

					html += this.getQuietPmButton(this.commandPrefix + ", " + updateCellCommand + ", " + x + ", " + y,
						UPDATE_CELL_BUTTON_TEXT, {disabled: disableAllCells || disableCell, style: EDIT_CELL_BUTTON_STYLE});

					html += '</td>';
				}
			}

			html += '</tr>';
		}

		html += '</table>';

		return html;
	}

	updateGridHtml(controlsOnly?: boolean): void {
		this.gridHtml = this.getGridHtml();
		if (!controlsOnly) this.roomViewGridHtml = this.getGridHtml(true);
	}

	reset(): void {
		this.prepareUndo(true);

		// createCell will invalidate cache and update saved grid cells
		const grid = this.getGrid(this.currentGridIndex);
		for (let x = 0; x < grid.length; x++) {
			for (let y = 0; y < grid[x].length; y++) {
				grid[x][y] = this.createCell(this.currentGridIndex, x, y);
			}
		}

		this.playerLocations[this.currentGridIndex] = {};
		this.pokemonIconLocations[this.currentGridIndex] = {};
		this.pokemonNames[this.currentGridIndex] = {};

		this.updateGridHtml(true);
		this.roomViewGridHtml = "";
		this.send();
	}

	submit(): void {
		if (this.roomViewGridHtml) this.props.onSubmit(this.currentGridIndex, this.roomViewGridHtml);
	}

	canFillRandomPokemon(index: number): boolean {
		return this.width[index] <= MAX_FILL_POKEMON_DIMENSIONS && this.height[index] <= MAX_FILL_POKEMON_DIMENSIONS;
	}

	fillRandomPokemon(): void {
		if (this.currentView !== 'pokemon' || !this.canFillRandomPokemon(this.currentGridIndex)) return;

		const grid = this.getGrid(this.currentGridIndex);
		for (const row of grid) {
			for (const cell of row) {
				if (cell.randomPokemon) this.erasePokemon(cell);
			}
		}

		const usedPokemon: string[] = [];
		for (const i in this.pokemonNames[this.currentGridIndex]) {
			usedPokemon.push(this.pokemonNames[this.currentGridIndex][i]);
		}

		const pokemonList = Tools.shuffle(this.pokemonList);
		for (const row of grid) {
			for (const cell of row) {
				if (cell.pokemonIcon) continue;

				const species = pokemonList.shift();
				if (!species) return;

				const pokemon = Dex.getExistingPokemon(species);
				const icon = Dex.getPokemonIcon(pokemon);
				this.insertPokemon(cell, pokemon.name, icon);
				cell.randomPokemon = true;

				this.updateCellCaches(cell);
			}
		}

		this.currentPokemon = "";
		this.currentPokemonIcon = "";

		this.updateGridHtml();
		this.send();
	}

	checkFilters(index: number): boolean {
		let allLetters = "";
		const rows: string[] = [];
		const columns: string[] = [];
		const diagonals: string[] = [];
		const grid = this.getGrid(index);
		const gridLength = grid.length;
		for (let x = 0; x < gridLength; x++) {
			const row = grid[x];
			let word = "";

			for (let y = 0; y < row.length; y++) {
				if (row[y].label) {
					// whole grid
					allLetters += row[y].label;

					// row
					word += row[y].label;

					// column
					if (!columns[y]) columns[y] = "";
					columns[y] += row[y].label;

					// diagonal
					let diagonal = row[y].label!;
					for (let diagonalRow = x + 1, diagonalColumn = y + 1; diagonalRow < gridLength; diagonalRow++, diagonalColumn++) {
						if (grid[diagonalRow][diagonalColumn] && grid[diagonalRow][diagonalColumn].label) {
							diagonal += grid[diagonalRow][diagonalColumn].label!;
						}
					}

					if (diagonal.length > 1) diagonals.push(diagonal);
				}
			}

			if (word) {
				rows.push(word);
			}
		}

		const words = [allLetters].concat(rows, columns, diagonals);
		for (const word of words) {
			if (!word) continue;

			const filterError = Client.checkFilters(word, this.htmlPage.room);
			if (filterError) {
				this.filterError[index] = "The specified labels contain a banned word";
				return true;
			}
		}

		this.filterError[index] = "";
		return false;
	}

	removeDuplicatePokemon(): void {
		const countedIcons: Dict<boolean> = {};
		const grid = this.getGrid(this.currentGridIndex);
		for (const row of grid) {
			for (const cell of row) {
				if (cell.pokemonIcon) {
					if (cell.pokemonIcon in countedIcons) {
						this.erasePokemon(cell);
						this.updateCellCaches(cell);
					} else {
						countedIcons[cell.pokemonIcon] = true;
					}
				}
			}
		}
	}

	cloneGrid(grid: ICellData[][], targetGridIndex: number): ICellData[][] {
		const gridCopy: ICellData[][] = [];
		for (const row of grid) {
			const rowCopy: ICellData[] = [];
			for (const cell of row) {
				const cellCopy = Object.assign({}, cell);
				// update gridIndex to prevent sync issues
				cellCopy.gridIndex = targetGridIndex;

				rowCopy.push(cellCopy);
			}
			gridCopy.push(rowCopy);
		}

		return gridCopy;
	}

	cloneSavedGrid(grid: ISavedCustomGridCell[][]): ISavedCustomGridCell[][] {
		const gridCopy: ISavedCustomGridCell[][] = [];
		for (const row of grid) {
			const rowCopy: ISavedCustomGridCell[] = [];
			for (const cell of row) {
				rowCopy.push(Object.assign({}, cell));
			}
			gridCopy.push(rowCopy);
		}

		return gridCopy;
	}

	prepareUndo(clearRedos?: boolean): void {
		const undoGrids = this.undoGrids[this.currentGridIndex];
		const undoSavedGrids = this.undoSavedGrids[this.currentGridIndex];
		if (undoGrids.length === HISTORY_LIMIT) {
			undoGrids.pop();
			if (undoSavedGrids.length) undoSavedGrids.pop();
		}

		const grid = this.getGrid(this.currentGridIndex);
		undoGrids.unshift(this.cloneGrid(grid, this.currentGridIndex));
		this.undosAvailable[this.currentGridIndex] = undoGrids.length;

		const savedGrid = this.getSavedGrid(this.currentGridIndex);
		if (savedGrid) undoSavedGrids.unshift(this.cloneSavedGrid(savedGrid.grid));

		if (clearRedos) {
			this.redoGrids[this.currentGridIndex] = [];
			this.redoSavedGrids[this.currentGridIndex] = [];
			this.redosAvailable[this.currentGridIndex] = 0;
		}
	}

	prepareRedo(): void {
		const redoGrids = this.redoGrids[this.currentGridIndex];
		const redoSavedGrids = this.redoSavedGrids[this.currentGridIndex];
		if (redoGrids.length === HISTORY_LIMIT) {
			redoGrids.pop();
			if (redoSavedGrids.length) redoSavedGrids.pop();
		}

		const grid = this.getGrid(this.currentGridIndex);
		redoGrids.unshift(this.cloneGrid(grid, this.currentGridIndex));
		this.redosAvailable[this.currentGridIndex] = redoGrids.length;

		const savedGrid = this.getSavedGrid(this.currentGridIndex);
		if (savedGrid) redoSavedGrids.unshift(this.cloneSavedGrid(savedGrid.grid));
	}

	redo(): void {
		if (!this.redosAvailable[this.currentGridIndex]) return;

		this.prepareUndo();

		this.grids[this.currentGridIndex] = this.cloneGrid(this.redoGrids[this.currentGridIndex][0], this.currentGridIndex);

		this.redoGrids[this.currentGridIndex].shift();
		this.redosAvailable[this.currentGridIndex]--;

		const savedGrid = this.getSavedGrid(this.currentGridIndex);
		if (savedGrid) {
			savedGrid.grid = this.cloneSavedGrid(this.redoSavedGrids[this.currentGridIndex][0]);
			this.redoSavedGrids[this.currentGridIndex].shift();
		}

		this.updateGridHtml();
		this.send();
	}

	undo(): void {
		if (!this.undosAvailable[this.currentGridIndex]) return;

		this.prepareRedo();

		this.grids[this.currentGridIndex] = this.cloneGrid(this.undoGrids[this.currentGridIndex][0], this.currentGridIndex);

		this.undoGrids[this.currentGridIndex].shift();
		this.undosAvailable[this.currentGridIndex]--;

		const savedGrid = this.getSavedGrid(this.currentGridIndex);
		if (savedGrid) {
			savedGrid.grid = this.cloneSavedGrid(this.undoSavedGrids[this.currentGridIndex][0]);
			this.undoSavedGrids[this.currentGridIndex].shift();
		}

		this.updateGridHtml();
		this.send();
	}

	tryCommand(originalTargets: readonly string[]): string | undefined {
		const targets = originalTargets.slice();
		const cmd = Tools.toId(targets[0]);
		targets.shift();

		if (cmd === chooseGridIndexCommand) {
			const index = targets[0] ? parseInt(targets[0].trim()) : -1;
			if (isNaN(index) || index < 0 || index > TEMPORARY_GRID_INDEX) return;

			this.setCurrentGridIndex(index);
		} else if (cmd === copyToGridIndexCommand) {
			const index = targets[0] ? parseInt(targets[0].trim()) : -1;
			if (isNaN(index) || index < 0 || index > TEMPORARY_GRID_INDEX) return;

			this.copyCurrentGridToIndex(index);
			this.setCurrentGridIndex(index);
		} else if (cmd === chooseColorsView) {
			this.chooseColorsView();
		} else if (cmd === choosePlayersView) {
			this.choosePlayersView();
		} else if (cmd === choosePokemonView) {
			this.choosePokemonView();
		} else if (cmd === chooseLabelsView) {
			this.chooseLabelsView();
		} else if (cmd === chooseHomeView) {
			this.chooseHomeView();
		} else if (cmd === chooseInsertMode) {
			this.chooseInsertMode();
		} else if (cmd === chooseEraseMode) {
			this.chooseEraseMode();
		} else if (cmd === chooseEraseAllMode) {
			this.chooseEraseAllMode();
		} else if (cmd === choosePlayer) {
			const id = targets[0] ? targets[0].trim() : "";
			if (!(id in this.playerLocations[this.currentGridIndex])) return;

			this.setPlayer(id);
		} else if (cmd === choosePokemon) {
			const name = targets[0] ? targets[0].trim() : "";
			let icon = "";
			for (const i in this.pokemonNames[this.currentGridIndex]) {
				if (this.pokemonNames[this.currentGridIndex][i] === name) {
					icon = i;
					break;
				}
			}

			if (!(icon in this.pokemonNames[this.currentGridIndex])) return;

			this.choosePokemon(name);
		} else if (cmd === setWidthCommand) {
			const width = parseInt(targets[0] ? targets[0].trim() : "");
			if (isNaN(width) || width < MIN_DIMENSION || width > this.maxDimensions) return;

			this.updateWidth(width);
			this.updateGridHtml();
			this.send();
		} else if (cmd === setHeightCommand) {
			const height = parseInt(targets[0] ? targets[0].trim() : "");
			if (isNaN(height) || height < MIN_DIMENSION || height > this.maxDimensions) return;

			this.updateHeight(height);
			this.updateGridHtml();
			this.send();
		} else if (cmd === setPixelsCommand) {
			const pixels = parseInt(targets[0] ? targets[0].trim() : "");
			if (isNaN(pixels) || pixels < MIN_PIXELS || pixels > MAX_PIXELS) return;

			this.updatePixelSize(pixels);
			this.checkPokemonIconCount(this.currentGridIndex);
			this.updateGridHtml();
			this.send();
		} else if (cmd === updateCellCommand) {
			this.updateCell(targets[0], targets[1]);
		} else if (cmd === updateColumnCommand) {
			this.updateColumn(targets[0]);
		} else if (cmd === updateRowCommand) {
			this.updateRow(targets[0]);
		} else if (cmd === updateAllCommand) {
			this.updateAll();
		} else if (cmd === allowDuplicatePokemonCommand) {
			if (this.allowDuplicatePokemon[this.currentGridIndex]) return;

			this.allowDuplicatePokemon[this.currentGridIndex] = true;
			const savedGrid = this.getSavedGrid(this.currentGridIndex);
			if (savedGrid) savedGrid.allowDuplicatePokemon = true;
			this.send();
		} else if (cmd === disallowDuplicatePokemonCommand) {
			if (!this.allowDuplicatePokemon[this.currentGridIndex]) return;

			this.allowDuplicatePokemon[this.currentGridIndex] = false;
			const savedGrid = this.getSavedGrid(this.currentGridIndex);
			if (savedGrid) savedGrid.allowDuplicatePokemon = false;

			this.removeDuplicatePokemon();
			this.updateGridHtml();
			this.send();
		} else if (cmd === randomPokemonCommand) {
			const randomPokemon = Tools.sampleOne(this.pokemonList);

			this.pokemonPicker.parentSetInput(randomPokemon);
			this.choosePokemon(randomPokemon);
		} else if (cmd === fillRandomPokemonCommand) {
			this.fillRandomPokemon();
		} else if (cmd === redoCommand) {
			this.redo();
		} else if (cmd === undoCommand) {
			this.undo();
		} else if (cmd === resetCommand) {
			this.reset();
		} else if (cmd === submitCommand) {
			this.submit();
		} else {
			return this.checkComponentCommands(cmd, targets);
		}
	}

	renderSelector(selector: HtmlSelector): string {
		let html = "";

		if (selector === this.previewSelector) {
			const temporaryGrid = this.currentGridIndex === TEMPORARY_GRID_INDEX;
			if (this.grids.length > 1) {
				const goToGridButtons: string[] = [];
				for (let i = 0; i < MAX_GRIDS; i++) {
					goToGridButtons.push(this.getQuietPmButton(this.commandPrefix + ", " + chooseGridIndexCommand + ", " + i,
						"Go to grid " + (i + 1), {disabled: this.currentGridIndex === i}));
				}

				goToGridButtons.push(this.getQuietPmButton(this.commandPrefix + ", " + chooseGridIndexCommand + ", " + TEMPORARY_GRID_INDEX,
						"Go to temporary grid", {disabled: temporaryGrid}));

				html += goToGridButtons.join(" | ");
				html += "<br /><br />";

				const copyToGridButtons: string[] = [];
				for (let i = 0; i < MAX_GRIDS; i++) {
					if (i === this.currentGridIndex) continue;

					copyToGridButtons.push(this.getQuietPmButton(this.commandPrefix + ", " + copyToGridIndexCommand + ", " + i,
						"Copy to grid " + (i + 1)));
				}

				if (!temporaryGrid) {
					copyToGridButtons.push(this.getQuietPmButton(this.commandPrefix + ", " + copyToGridIndexCommand + ", " +
						TEMPORARY_GRID_INDEX, "Copy to temporary grid"));
				}

				html += copyToGridButtons.join(" | ");
				html += "<br /><br />";
			}

			if (this.roomViewGridHtml) {
				html += "<b>Preview</b>:<br />" + this.roomViewGridHtml;
				html += "<br />";
			} else {
				html += "You can customize the grid with colors, player markers, Pokemon icons, and cell labels!";
				html += "<br /><br />";
				html += "Choose a property, enter a value, make sure you're in the desired edit mode, and then click one of the edit " +
					"buttons:";
				html += "<ul>";
				html += "<li><button class='button'>" + UPDATE_ALL_BUTTON_TEXT + "</button> - edit the entire grid</li>";
				html += "<li><button class='button'>" + UPDATE_ROW_BUTTON_TEXT + "</button> - edit that row</li>";
				html += "<li><button class='button'>" + UPDATE_COLUMN_BUTTON_TEXT + "</button> - edit that column</li>";
				html += "<li><button class='button'>" + UPDATE_CELL_BUTTON_TEXT + "</button> - edit that cell</li>";
				html += "</ul>";
			}

			if (this.filterError[this.currentGridIndex]) {
				html += "<b>" + this.filterError[this.currentGridIndex] + "</b>";
				html += "<br />";
			}
		} else if (selector === this.controlsSelector) {
			html += this.gridHtml;
		} else {
			html += "<b>Actions</b>:";
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + undoCommand, "Undo",
				{disabled: !this.undosAvailable[this.currentGridIndex]});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + redoCommand, "Redo",
				{disabled: !this.redosAvailable[this.currentGridIndex]});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + resetCommand, "Reset");

			if (this.props.showSubmit) {
				html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + submitCommand, "Submit");
			}
			html += "<br /><br />";

			const home = this.currentView === 'home';
			const colors = this.currentView === 'colors';
			const players = this.currentView === 'players';
			const pokemon = this.currentView === 'pokemon';
			const labels = this.currentView === 'labels';

			let insertEraseText: string;
			let eraseDisabled = home || this.currentMode === 'erase';
			if (colors) {
				insertEraseText = 'color';
				eraseDisabled = !this.currentCellColor;
			} else if (players) {
				if (this.currentPlayer) {
					insertEraseText = this.currentPlayer;
				} else {
					insertEraseText = 'player';
					eraseDisabled = true;
				}
			} else if (pokemon) {
				if (this.currentPokemon) {
					insertEraseText = this.currentPokemon;
				} else {
					insertEraseText = 'Pokemon';
					eraseDisabled = true;
				}
			} else if (labels) {
				if (this.currentLabel) {
					insertEraseText = "'" + this.currentLabel + "'";
				} else {
					insertEraseText = 'label';
					eraseDisabled = true;
				}
			} else {
				insertEraseText = "";
			}

			html += "<b>Edit modes</b>:";
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + chooseInsertMode,
				"Insert" + (insertEraseText ? " " + insertEraseText : ""), {disabled: home || this.currentMode === 'insert'});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + chooseEraseMode,
				"Erase" + (insertEraseText ? " " + insertEraseText : ""), {disabled: eraseDisabled});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + chooseEraseAllMode, "Erase all",
				{disabled: home || this.currentMode === 'eraseall'});
			html += "<br /><br />";

			html += "<b>Navigation</b>:";
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + chooseHomeView, "Home", {selectedAndDisabled: home});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + chooseColorsView, "Colors", {selectedAndDisabled: colors});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + choosePlayersView, "Players",
				{selectedAndDisabled: players});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + choosePokemonView, "Pokemon icons",
				{selectedAndDisabled: pokemon});
			html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + chooseLabelsView, "Labels", {selectedAndDisabled: labels});

			html += "<hr />";

			if (home) {
				html += "<b>Number of columns</b>";
				for (let i = MIN_DIMENSION; i <= this.maxDimensions; i++) {
					html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + setWidthCommand + ", " + i, "" + i,
						{selectedAndDisabled: this.width[this.currentGridIndex] === i});
				}

				html += "<br /><br />";

				html += "<b>Number of rows</b>";
				for (let i = MIN_DIMENSION; i <= this.maxDimensions; i++) {
					html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + setHeightCommand + ", " + i, "" + i,
						{selectedAndDisabled: this.height[this.currentGridIndex] === i});
				}

				html += "<br /><br />";

				html += "<b>Cell size</b> (in pixels)";
				for (let i = MIN_PIXELS; i <= MAX_PIXELS; i += 5) {
					html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + setPixelsCommand + ", " + i, "" + i,
						{selectedAndDisabled: this.pixelSize[this.currentGridIndex] === i});
				}
			} else if (colors) {
				html += "<b>Cell fill color</b> ";
				html += this.cellColorPicker.render();
			} else if (players) {
				html += "<b>Cell player marker</b>";
				if (this.currentPlayer) {
					html += ": <span";
					if (this.currentPlayerColor) html += " style='color: " + this.currentPlayerColor + "'";
					html += ">" + this.currentPlayer + "</span>";
				}

				const currentPlayers: string[] = [];
				for (const i in this.playerLocations[this.currentGridIndex]) {
					currentPlayers.push(this.getQuietPmButton(this.commandPrefix + ", " + choosePlayer + ", " + i, i,
						{selectedAndDisabled: i === this.currentPlayer}));
				}

				if (currentPlayers.length) {
					html += "<br />";
					html += currentPlayers.join(" ");
				}

				html += this.playerPicker.render();
				html += "<br /><br />";
				html += "<b>Marker color</b> ";
				html += this.playerColorPicker.render();
			} else if (pokemon) {
				html += "<b>Pokemon icons</b>";
				if (this.currentPokemonIcon) html += ": " + this.currentPokemonIcon;

				if (this.allowDuplicatePokemon[this.currentGridIndex]) {
					html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + disallowDuplicatePokemonCommand,
						"Disallow duplicate Pokemon");
				} else {
					html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + allowDuplicatePokemonCommand,
						"Allow duplicate Pokemon");
				}
				html += "<br />";

				const currentIcons: string[] = [];
				for (const i in this.pokemonIconLocations[this.currentGridIndex]) {
					currentIcons.push(this.getQuietPmButton(this.commandPrefix + ", " + choosePokemon + ", " +
						this.pokemonNames[this.currentGridIndex][i], this.pokemonNames[this.currentGridIndex][i],
						{selectedAndDisabled: i === this.currentPokemonIcon}));
				}

				if (currentIcons.length) {
					html += "<br />";
					html += currentIcons.join(" ");
				}

				html += "<br /><br />";
				html += this.getQuietPmButton(this.commandPrefix + ", " + randomPokemonCommand, "Single random Pokemon");
				html += "&nbsp;" + this.getQuietPmButton(this.commandPrefix + ", " + fillRandomPokemonCommand, "Fill with random Pokemon",
					{disabled: !this.canFillRandomPokemon(this.currentGridIndex)});
				html += this.pokemonPicker.render();
			} else if (labels) {
				html += "<b>Cell label</b>";
				if (this.currentLabel) {
					html += ": <span";
					if (this.currentLabelColor) html += " style='color: " + this.currentLabelColor + "'";
					html += "><b>" + this.currentLabel + "</b></span>";
				}

				html += this.labelInput.render();
				html += "<br /><br />";
				html += "<b>Label color</b> ";
				html += this.labelColorPicker.render();
			}
		}

		return html;
	}
}
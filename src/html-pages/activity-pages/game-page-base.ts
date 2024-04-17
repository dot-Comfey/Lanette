import type { Player } from "../../room-activity";
import type { ScriptedGame } from "../../room-game-scripted";
import type { IGameCustomBox } from "../../types/storage";
import { HexCode, IHexCodeData } from "../../types/tools";
import type { HtmlSelector, IQuietPMButtonOptions } from "../html-page-base";
import { ActivityPageBase, type IActivityPageOptions } from "./activity-page-base";

export interface IGamePageOptions extends IActivityPageOptions {
    customBox?: IGameCustomBox;
    pageName?: string;
}

export abstract class GamePageBase extends ActivityPageBase {
    declare activity: ScriptedGame;

    customBox?: IGameCustomBox;
    pageName?: string;

    constructor(activity: ScriptedGame, player: Player, baseCommand: string, options: IGamePageOptions) {
		super(activity, player, baseCommand, options);

        this.customBox = options.customBox;
        this.pageName = options.pageName;

        if (this.customBox) {
            let background: HexCode | IHexCodeData | undefined;
			if (this.customBox.gameBackground) {
				background = this.customBox.gameBackground;
			} else if (this.customBox.background) {
				background = this.customBox.background;
			}

            if (background) this.selectorDivsSpan = Tools.getHexSpan(background);

            this.setCloseButtonHtml({style: Games.getCustomBoxButtonStyle(this.customBox, "game")});
        }
    }

    initializeSelectors(): void {
        if (this.initializedSelectors) return;

        super.initializeSelectors();

        this.sendSelector(this.headerSelector!);
    }

    getQuietPmButton(message: string, label: string, options?: IQuietPMButtonOptions): string {
        if (this.customBox) {
            const disabled = this.getButtonDisabled(options);

            if (!options) options = {};
            options.style = Games.getCustomBoxButtonStyle(this.customBox, 'game', disabled);
        }

        return super.getQuietPmButton(message, label, options);
    }

    renderSelector(selector: HtmlSelector): string {
        let html = "";
        if (selector === this.headerSelector) {
            html += "<center><b>" + (this.pageName || this.activity.format.nameWithOptions) + "</b>";

            if (this.closeButtonHtml && !this.activity.ended) {
                html += "&nbsp;" + this.closeButtonHtml;
            }

            if (this.activity.ended) {
                html += "<br /><h3>The game has ended!</h3>";
            } else if (this.showSwitchLocationButton) {
                html += "<br />" + this.switchLocationButtonHtml;
            }

            html += "</center>";
        }

        return html;
    }

    // both render types need to remain to allow pages to be moved to the chat
    render(): string {
        let html = "<div class='chat' style='margin-top: 4px;margin-left: 4px'><center><b>" +
            (this.pageName || this.activity.format.nameWithOptions) + "</b>";

        if (this.closeButtonHtml && !this.activity.ended) {
            html += "&nbsp;" + this.closeButtonHtml;
        }

        if (this.activity.ended) {
            html += "<br /><h3>The game has ended!</h3>";
        } else if (this.showSwitchLocationButton) {
            html += "<br />" + this.switchLocationButtonHtml;
        }

        html += "</center>";

        let details = this.renderDetails();
        if (this.customBox) {
            details = Games.getGameCustomBoxDiv(details, this.customBox);
        }

        html += details;
        html += "</div>";

        return html;
    }
}

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, ChoicePrompt, ListStyle, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const WATERFALL = 'waterfallDialog';
const CHOICE_PROMPT = 'choicePrompt';

class ButtonDialog extends ComponentDialog {
    constructor(id) {
        super(id || 'buttonDialog');

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(new ChoicePrompt(CHOICE_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL, [
                this.actStep.bind(this),
				this.final.bind(this)
            ]));
            
        this.initialDialogId = WATERFALL;
    }

    /**
     * Second step in the waterfall.
     */
    async actStep(stepContext) { 
		let messageText = "";
        const query = stepContext.options.query;
        const previousIntent = stepContext.options.previousIntent;
       
        messageText = query[previousIntent].text
        let buttonIntents = query[previousIntent].intents
        let options = [];
     
        for (let i of Object.values(buttonIntents)) {
            if (i.button) {
                options.push(i.button)
            }
        }
        return await stepContext.prompt(CHOICE_PROMPT, { prompt: messageText, choices: options, style: ListStyle.suggestedAction });
    }
	
	async final(stepContext) {
		// Collect user input
        stepContext.options.selection = stepContext.result.value
		return await stepContext.endDialog(stepContext.options)
	}

}

module.exports.ButtonDialog = ButtonDialog;

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { TimexProperty } = require('@microsoft/recognizers-text-data-types-timex-expression');
const { MessageFactory, InputHints } = require('botbuilder');
const { LuisRecognizer } = require('botbuilder-ai');
const { ComponentDialog, ChoicePrompt, ListStyle, DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const WATERFALL = 'waterfallDialog';
const CHOICE_PROMPT = 'choicePrompt';
const TEXT_PROMPT = 'textPrompt';

class ExpectinginputDialog extends ComponentDialog {
    constructor(id) {
        super(id || 'expectinginputDialog');

        // Define the main dialog and its related components.
        // This is a sample "book a flight" dialog.
        this.addDialog(new TextPrompt(TEXT_PROMPT))
            .addDialog(new ChoicePrompt(CHOICE_PROMPT))
            .addDialog(new WaterfallDialog(WATERFALL, [
                this.nameStep.bind(this),
                this.emailStep.bind(this),
				this.final.bind(this)
            ]));
            
        this.initialDialogId = WATERFALL;
    }

    async nameStep(stepContext) { 
		let messageText = "";
        const query = stepContext.options.query;
        const myIntent = stepContext.options.myIntent;
        messageText = query[myIntent]["expectinginput"]["text1"]
        return await stepContext.prompt(TEXT_PROMPT, { prompt: messageText });
    }
    
    async emailStep(stepContext) {  
        stepContext.options.expectinginput = {};
        stepContext.options.expectinginput["text1"] = stepContext.result;
		let messageText = "";
        const query = stepContext.options.query;
        const myIntent = stepContext.options.myIntent;
        messageText = query[myIntent]["expectinginput"]["text2"]
        return await stepContext.prompt(TEXT_PROMPT, { prompt: messageText });
    }
	
	async final(stepContext) {
        stepContext.options.expectinginput["text2"] = stepContext.result;
		let messageText = "";
        const query = stepContext.options.query;
        const myIntent = stepContext.options.myIntent;
        messageText = query[myIntent]["expectinginput"]["closing"]
        await stepContext.context.sendActivity(messageText, null, InputHints.IgnoringInput);
        stepContext.options.nextMessage = "What else can I help you with today?"
		return await stepContext.endDialog(stepContext.options)
	}

}

module.exports.ExpectinginputDialog = ExpectinginputDialog;

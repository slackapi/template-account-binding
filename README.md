# Account Binding Template

A Sample Slack app that shows how a user account on Slack can be bound to an account on another system.

![account-binding](https://user-images.githubusercontent.com/700173/27056630-b57cd40c-4f7d-11e7-98f1-7e723f472192.gif)

## Setup

#### Create a Slack app

1. Create an app at api.slack.com/apps
1. Click on `Bot Users`
1. Add a bot user and make sure it displays as always online
1. Install the app and copy the `xoxb-` token

#### Run locally or [![Remix on Glitch](https://cdn.glitch.com/2703baf2-b643-4da7-ab91-7ee2a2d00b5b%2Fremix-button.svg)](https://glitch.com/edit/#!/remix/slack-account-binding-blueprint)
1. Get the code
    * Either clone this repo and run `npm install`
    * Or visit https://glitch.com/edit/#!/remix/slack-account-binding-blueprint
1. Set the following environment variables to `.env` (see `.env.sample`):
    * `SLACK_BOT_TOKEN`: Your app's `xoxb-` token (available on the Install App page)
    * `SLACK_VERIFICATION_TOKEN`: Your app's Verification Token (available on the Basic Information page)
    * `SESSION_SECRET`: A randomly generated secret for your session storage
1. If you're running the app locally:
    1. Start the app (`npm start`)
    1. In another windown, start ngrok on the same port as your webserver (`ngrok http $PORT`)

#### Add Slash Commands
1. Go back to the app settings and click on Slash Commands
1. Add the following Slash Commands:
    * Command: /read-message
        * Request URL: ngrok or Glitch URL + api/slack/command
        * Description: Read secret message
    * Command: /write-message
        * Request URL: ngrok or Glitch URL + api/slack/command
        * Description: Write secret message
        * Usage Hint: [message]
1. Reinstall the app by navigating to the Install App page

#### In Slack

1. In any channel, run /read-message
1. You should see a DM from the bot asking you to link your accounts

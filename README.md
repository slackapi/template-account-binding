# Channel Naming Slack App Template

A Sample Slack app that shows how a user account on Slack can be bound to an account on another system.

## Setup

#### Create a Slack app

1. Create an app at api.slack.com/apps
1. Click on `Bot Users`
1. Add a bot user and make sure it displays as always online
1. Install the app and copy the `xoxb-` token

#### Clone and run this repo
1. Clone this repo and run `npm install`
1. Copy the config file (`/config/default.json`) to `/config/dev.json`:
1. Edit the dev config file (`/config/dev.json`) to update the following values:
    * `botToken`: Your app's `xoxb-` token (available on the Install App page)
    * `verificationToken`: Your app's Verification Token (available on the Basic Information page)
    * `secret`: A randomly generated secret for your session storage
1. Start the app (`NODE_ENV=dev npm start`)
1. In another windown, start ngrok on the same port as your webserver (`ngrok http 3000`)

#### Add Slash Commands
1. Go back to the app settings and click on Slash Commands
1. Add the following Slash Commands:
    * Command: /read-message
        * Request URL: ngrok URL + api/slack/command
        * Description: Read secret message
    * Command: /write-message
        * Request URL: ngrok URL + api/slack/command
        * Description: Write secret message
        * Usage Hint: [message]
1. Reinstall the app by navigating to the Install App page

#### In Slack

1. In any channel, run /read-message
1. You should see a DM from the bot asking you to link your accounts

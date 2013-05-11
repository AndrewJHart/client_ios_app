client_ios_app
==============
Real-time Backbone.js app with iOS styling -- post a message and all other users see it without having to refresh. Extends Backbone Collection & Model objects - adding web sockets (and fallback polling) support (pub/sub), by subscribing to specific events that map the incoming data to the correct backbone Collection/Model method. -- This is the whole app as an example of real time messaging app with an iOS theme. NOTE: The server side implementation is up to you and will require a server side websocket implementation (last build of this was testing pusher.js which has simple server drop-in for any language)
-- with the addition of testing pusher.js, I've included backbone-live.js which was built around a similar principle of extending collections and has native support for pusher

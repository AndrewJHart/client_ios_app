//---------------------------------------------------------------//
// Backbone client - using CSS + imgs to get the Native iOS look //
// Andrew Hart 11/12 MSCNS www.mscns.com || www.pressedweb.com   //
//---------------------------------------------------------------//


// extending the core
Backbone.View.prototype.close = function () {
    if (this.beforeClose) {
        this.beforeClose();
    }

    console.log('Unbinding events for view ' + this.cid);
    this.undelegateEvents();
    this.remove();
    this.unbind();
};

(function ($) {

    'use strict';


    //-----------------//
    // Client Models   //
    //-----------------//

    // Create basic model that mirrors our backend
    window.Message = Backbone.LiveModel.extend({
        urlRoot:'http://mscns.webfactional.com/dev-api/events/api/v2/message/', // cross domain needed for apps so we my as well use it here too

        url: function () {
            // return the url root and if the id exists then the verb is PUT so append it to the root
            // else its POST and all we need is the root url - ** be wary of removing the trailing slash ;)
            return this.urlRoot + (this.id !== null ? (this.id + '/') : '');
        },

        // used to populate fields of new model in the form when user clicks add
        defaults:{
            'id':null,
            'name':'',
            'description':''
        }
    });

    // collection of models - requires underscore.js
    window.Messages = Backbone.LiveCollection.extend({
        model: Message,

        // if / at beginning of url string then it loads just domain + entire url string
        // if no / at beginning it loads current url + url string (ie: site is mscns.com/client-api then url
        // becomes mscns.com/client-api/message) but with forward slash its just mscns.com/message/
        url: 'http://mscns.webfactional.com/dev-api/events/api/v2/message/',

        initialize: function() {
            this.cachedCollection = {};
        },

        findByName: function (key) {
            console.log('findByName: ' + key);

            // prepend djangos search filter onto the query
            var query = '?name__contains=' + key;
            var url = this.url + query;

            var self = this;

            this.fetch({
                url: url,
                cache: false,

                success: function (collection, response) {
                    console.log('**findByName fetch successful!');

                    // store a copy of the collection for filtering and resetting later
                    self.cachedCollection.reset(self.models);
                },

                error: function (collection, xhr, options) {
                    console.log('Error on fetch attempt. Test cached results. Filter on cached collection instead.');

                    // if nothing entered in search then reset collection with cached version
                    if (key === "") {
                        //self.reset(_.toArray(self.cachedCollection.models));
                        self.reset(self.cachedCollection.models);
                    }
                    else {
                        var pattern = new RegExp(key, "gi");

                        // filter the collection
                        var results = self.filter(function(data) {
                            return pattern.test(data.get("name"));
                        });

                        console.log(results);
                        self.reset(results);
                    }
                }
            });
        }
    });


    //--------------//
    // client views //
    //--------------//

    window.MessagePageView = Backbone.View.extend({

        initialize: function() {
            this.template = _.template($('#search-main').html());
        },

        render: function (eventName) {
            $(this.el).html(this.template(this.model.toJSON()));  // throw json string to template and attach to page

            // only instantiate the listview one time and keep a reference to it
            this.listView = new MessageListView({ /* el: $('ul', this.el), */ model: this.model, collection: this.collection });

            this.listView.render();

            return this;
        },

        events: {
            'keyup .search-query': 'search',
            'click .add-message': 'addMessage'
        },

        search: function (e) {
            var queryVal = $('.search-query').val();
            console.log('search query is: ' + queryVal);

            // call Search with Key(s) entered by the user
            this.model.findByName(queryVal);
        },

        addMessage: function(e) {
            App.navigate('add/', true);

            return false;
        }
    });

    // ul view - wrapper for list items view
    window.MessageListView = Backbone.View.extend({
        tagName: 'ul',

        initialize: function () {
            this.collection.bind('reset', this.render, this);   // render whenever reset is triggered
            this.collection.bind('change', this.render, this);  // render whenever a change is triggered in the list
            this.collection.bind('add', this.render, this);     // render whenever a new model is added to the collection
            this.collection.bind('remove', this.render, this);  // also re-render after an item is removed via pusher to reflect changes in list
        },

        render: function () {
            var self = this;
            this.$el.empty();

            // instantiate the list items and pass to list item view for rendering
            this.collection.each(function (message) {
                self.$el.append(new MessageListItemView({ model: message }).render().el);
            }, this);

            console.log('Message List :: Render :: End');

            return this;
        }
    });

    // Main event list view tied to event-lists dom
    window.MessageListItemView = Backbone.View.extend({
        tagName: 'li',

        initialize: function() {
            this.template = _.template($('#message-list-item').html());
            this.model.bind('destroy', this.close, this);  // on destroy this model we want to close this view
        },

        render: function () {
            // automatically take our json object, parse it, and put it into html template with underscore tmpl
            this.$el.html(this.template(this.model.toJSON()));
            window.console.log(this.model.toJSON());

            return this;
        }
    });

    // Add Message View
    window.MessageCreateView = Backbone.View.extend({
        events: {
            'click .save': 'saveMessage'
        },

        initialize: function() {
            this.template = _.template($('#message-create-item').html());
            //this.model.bind('change', this.render, this);
        },

        render: function () {
            // automatically take our json object, parse it, and put it into html template with underscore tmpl
            this.$el.html(this.template(this.model.toJSON()));
            window.console.log(this.model.toJSON());

            return this;
        },

        saveMessage: function() {
            window.console.log('event save initiated');

            // get our model data from HTML elements values
            // id: App.messages.length+1, // Get last id/pk of collection and add one for new id  $('#eventid').val(),
            this.model.set({
                name:$ ('#name').val(),
                description:$ ('#description').val()
            });

            if (this.model.isNew()) {
                //this.model.url = this.model.urlRoot;
                var self = this;

                // I choose to pass the collection in the options hash upon instantiation - however we could do away with OOP and
                // ensure that client.App.messages !== null and then call create on it... would rather do it by passing collection to my view

                this.collection.create(this.model, {
                    wait: true,
                    success:function () {
                        window.console.log('success callback - on POST complete');

                        App.navigate('', true);
                    }
                });
            }
            else {
                var that = this;

                this.model.save({}, {
                    //wait: true,
                    success:function () {
                        window.console.log('success callback - PUT complete');
                    },
                    error:function () {
                        window.console.log('Error on PUT');
                    }
                });
            }
            return false;
        }
    });

    // Detail view - shows more info on selected event and has buttons for changes
    window.EventDetailView = Backbone.View.extend({

        events: {
            'click .delete': 'deleteEvent'
        },

        initialize: function () {
            this.template = _.template($("#message-detail").html());
            //this.model.bind('change', this.render, this); // TODO: temporary will enable when i find fix.
            //this.model.bind('destroy', this.close, this);
        //    this.model.bind('reset', this.render, this);
        },

        render: function () {
            // Order of Ops => pass object json data to _ template to fill then pass that markup to element in the DOM
            this.$el.html(this.template(this.model.toJSON()));

            return this;
        },

        deleteEvent: function () {
            // get the model associated with this view
            this.model.destroy({
                success:function () {
                    window.console.log('model destroyed');
                    App.navigate("", true);
                },
                error: function() {
                    window.console.log('no access to server - use localstorage');
                    App.navigate("", true);
                }
            });

            return false;
        }
    });


    //----------------//
    // client routing //
    //----------------//

    // Create the Router for the application
    var AppRouter = Backbone.Router.extend({
        routes:{
            '': 'list',
            'add/': 'add',
            ':id/': 'detail'
        },

        // constructor - header, footer, actions / extremely reusable markup
        initialize: function () {
            this.content = $('#content');

            this.content.on('click', '.header-back-button', function(event) {
                window.history.back();
                return false;
            });

            this.firstPage = true;
            this.pageHistory = [];

            var self = this;

            //------------------------------------------------//
            // Courtesy of Coenrates...                       //
            // Check of browser supports touch events...      //
            if (document.documentElement.hasOwnProperty('ontouchstart')) {
                // ... if yes: register touch event listener to change the "selected" state of the item
                this.content.on('touchstart', 'a', function(event) {
                    self.selectItem(event);
                });
                this.content.on('touchend', 'a', function(event) {
                    self.deselectItem(event);
                });
            } else {
                // ... if not: register mouse events instead
                this.content.on('mousedown', 'a', function(event) {
                    self.selectItem(event);
                });
                this.content.on('mouseup', 'a', function(event) {
                    self.deselectItem(event);
                });
            }

            // moved some of the list insantiation work to here
            this.messages = new Messages();

            this.pusher = new Pusher('3fb8e3f49e89f2640bc9');

            this.messages.live({pusher:this.pusher, channel:'client-api', channelName:'client-api', log:true, eventType:'message'});

            this.searchPage = new MessagePageView({model: this.messages, collection: this.messages });

        },

        selectItem: function(event) {
            $(event.target).addClass('tappable-active');
        },

        deselectItem: function(event) {
            $(event.target).removeClass('tappable-active');
        },

        // Standard List View (Fetches objects, passes the collection to listView which instantiates ListItemView and writes to template
        list: function () {
            if (this.currentView)
            {
                this.currentView.remove();
                this.currentView.close();
                this.currentView = null;
            }


            // if this is first render then show the entire list
            if (this.firstPage) {

                this.firstPage = false;
                console.log('fetching entire collection from Server for first render.');
                
                // this will not work unless we wait for success and then act
                this.messages.fetch({wait: true});

                // TODO: store a copy of the collection before filtering and resetting it
                this.messages.cachedCollection = new Messages();
                this.messages.cachedCollection.reset(this.messages.models);

            }

            this.changePage(this.searchPage.render());
        },

        // Detail View fetches one model from the list and instantiates only the detail or list view passing single model to it
        detail:function (id) {
            window.console.log('detail route activated');

            if (this.currentView)
            {
                this.currentView.remove();
                this.currentView.close();
                this.currentView = null;
            }

            // get our single model from the collection by id
            if (App.messages) {
                this.message = App.messages.get(id);
                this.currentView = new EventDetailView({ model: this.message });
                this.changePage(this.currentView.render());
            }
        },

        add: function() {
            if (this.currentView) {
                this.currentView.remove();
                this.currentView.close();
                this.currentView = null;
            }

            // render a new view for posting messages
            this.currentView = new MessageCreateView({model: new Message(), collection: this.messages });
            this.changePage(this.currentView.render());  // pass collection by reference
            window.console.log('new event added');
        },

        // on route add render

        changePage: function (page) {
            var slideFrom,
                self = this;

            this.slideFrom = "left";

            if (!this.currentPage) {
                // If there is no current page (app just started) -> No transition: Position new page in the view port
                $(page.el).attr('class', 'page stage-center');
                this.content.append(page.el);
                this.pageHistory = [window.location.hash];
                this.currentPage = page;

                return;
            }

            if (page !== this.searchPage) {
                // remove the add message button
                $('.add-message').remove();
            }

            // Cleaning up: remove old pages that were moved out of the viewport
            //$('.stage-right, .stage-left').not('#search-main').remove();

            console.log('calling render for view object ' + page.cid + ' rendering in changePage');

            this.content.append(page.el);
        }
    });

    window.App = new AppRouter();
    Backbone.history.start();

})(jQuery);

//-------------------------------------------------------------//
// HTML5 + JS Application  - Andrew Hart 11/12 MSCNS
// *Caveats



(function ($) {

    'use strict';

    // extending the core
    Backbone.View.prototype.close = function () {
        this.remove();  // remove element from dom
        this.unbind();  // unbind the views events

        // trigger onClose in view
        if (this.onClose) {
            this.onClose();  // make the view unbind from the collection or model its bound too
        }
    };


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
            'description':'',
            'priority': '1',
            'alert': 'a'
        },

        initialize: function() {
            // generate a unique id for each model so we can access them in local storage array by id
            // NOTE: we have to do this b/c we dont want this data on the server and the model id by default is null
            this.uniqueID = ((Math.random() + 1) * (Math.random()));
        }
    });

    // collection of models - requires underscore.js
    window.Messages = Backbone.LiveCollection.extend({
        model: Message,

        url: 'http://mscns.webfactional.com/dev-api/events/api/v2/message/',

        initialize: function() {
            this.cachedCollection = {};
            this.records = [];
        },

        findByName: function (key) {
            console.log('findByName: ' + key);

            // prepend djangos search filter onto the query
            var query = '?name__contains=' + key;
            var url = this.url + query;

            var self = this;
            var localModels = [];

            this.fetch({
                url: url,
                cache: false,

                success: function (collection, response) {
                    console.log('**Search fetch successful!');

                    // store a copy of the collection for filtering and resetting later
                    collection.each(function(model) {
                        localStorage.setItem(model.uniqueID, JSON.stringify(model));
                        self.records.push(model.uniqueID);  // keep array to iterate and for length etc..
                    });
                },

                error: function (collection, xhr, options) {
                    console.log('Error on fetch attempt. Test cached results. Filter on cached collection instead.');

                    // if nothing entered in search then reset collection with cached version
                    if (key === "") {
                        //self.reset(_.toArray(self.cachedCollection.models));
                        for (var i=0; i<self.records.length; i++) {
                            localModels.push(JSON.parse(localStorage.getItem(self.records[i])));
                        }
                        console.log(localModels);
                        self.reset(localModels);
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

    window.SearchPage = Backbone.View.extend({
        template: Handlebars.compile($('#collection-list').html()),  // template for the ul list using handlebars

        initialize: function() {
            this.mainTemplate = _.template($('#search-main').html());  // standard underscore template as we need none of handlebars features here

            this.collection.bind('reset', this.updateList, this);   // render whenever reset is triggered
            this.collection.bind('change', this.updateList, this);  // render whenever a change is triggered in the list
            this.collection.bind('add', this.updateList, this);     // render whenever a new model is added to the collection
            this.collection.bind('remove', this.updateList, this);  // also re-render after an item is removed via pusher to reflect changes in list
        },

        render: function () {
            this.$el.empty();

            this.$el.html(this.mainTemplate(this.model.toJSON()));  // throw json string to template and attach to page

            this.updateList();  // since we have to make a choice on separation of views or logic to make search work then keep it simple by not
                            // re-drawing the list each time the collection observes change. Call once for render here ;)
            return this;
        },

        // use separate render function for rendering only the list - not the entire search page or we lost focus on keyup when searching cuz collection is triggered
        updateList: function() {
            $('#myList', this.el).empty();

            //---------------------------------------------------------------//
            // Trying handlebars instead of using extra view with underscore //
            //---------------------------------------------------------------//
            $('#myList', this.el).html(this.template({ collection: this.collection.toJSON() }));

            console.log('Collection ListView :: Updated / Rendered');

            return this;
        },

        events: {
            'keyup .search-query': 'search',
            'click .add-message': 'add'
        },

        search: function (e) {
            var queryVal = $('.search-query').val();
            console.log('search query is: ' + queryVal);

            // call Search with Key(s) entered by the user
            this.model.findByName(queryVal);
        },

        add: function(e) {
            this.slideFrom = 'right';
            App.navigate('add/', true);

            return false;
        },

        onClose: function () {
            this.collection.unbind();  // call unbind on the collection or have zombies everywhere!
            console.log('MessageListView::onClose method triggered');
        }
    });


    // Add Message View
    window.NewPage = Backbone.View.extend({
        events: {
            'click .save': 'save',
            'click .search': 'search',
            'click .back': 'back'
        },

        initialize: function() {
            this.template = _.template($('#message-create-item').html());
        },

        render: function () {
            // automatically take our json object, parse it, and put it into html template with underscore tmpl
            this.$el.html(this.template(this.model.toJSON()));
            window.console.log(this.model.toJSON());

            return this;
        },

        search: function() {
            this.slideFrom = 'left';
            return this;
        },

        back: function() {
            this.slideFrom = 'right';
            return this;
        },

        save: function() {
            window.console.log('event save initiated');

            // get our model data from HTML elements values
            // id: App.messages.length+1, // Get last id/pk of collection and add one for new id  $('#eventid').val(),
            this.model.set({
                name:$ ('#name').val(),
                description:$ ('#description').val()
            });


            console.log('status of internet connection: ' + this.collection.activeStatus);

            if (this.model.isNew()) {

                if (this.collection.activeStatus) {
                    // I choose to pass the collection in the options hash upon instantiation - however we could do away with OOP and
                    // ensure that client.App.messages !== null and then call create on it... would rather do it by passing collection to my view
                    this.collection.create(this.model, {
                        wait: true,  // To prevent duplicates from local + pusher use wait: true when connected to internet
                        success: function () {
                            window.console.log('success callback - on POST complete');

                            App.navigate('', true);
                        }
                    });
                }
                else {
                    this.collection.create(this.model, {
                        wait: false,  // pass wait false when disconnected so collection gets the model then update localstorage
                        error: function () {
                            window.console.log('*Cant sync with server. Saving to LocalStorage.');
                        }
                    });

                    // TODO: wrap all this up nice & neat later
                    localStorage.setItem(self.model.uniqueID, JSON.stringify(self.model));
                    self.collection.records.push(self.model.uniqueID);  // keep array to iterate and for length etc..
                    App.navigate('', true);
                }
            }

            this.slideFrom = 'right';
            return false;
        }
    });

    // Detail view - shows more info on selected event and has buttons for changes
    window.ItemPage = Backbone.View.extend({

        events: {
            'click .delete': 'removeItem', // Changed func name from delete to removeItem due to IE 8 delete reserved keyword
            'click .search': 'search',
            'click .back': 'back'
        },

        initialize: function () {
            this.template = _.template($("#message-detail").html());
            this.model.bind('change', this.render, this); // TODO: temporary will enable when i find fix.
        },

        render: function () {
            // Order of Ops => pass object json data to _ template to fill then pass that markup to element in the DOM
            this.$el.html(this.template(this.model.toJSON()));

            return this;
        },

        search: function() {
            this.slideFrom = 'right';
            return this;
        },

        back: function() {
            this.slideFrom = 'left';
            return this;
        },

        removeItem: function () {
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

            this.slideFrom = 'right';

            return false;
        },

        onClose: function() {
            this.model.unbind('change', this.render);
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

            this.firstTransition = true;
            this.firstRun = true;
            this.viewRef = false;

            var self = this;

            //------------------------------------------------//
            // Courtesy of Coenrates...                       //
            // Check of browser supports touch events...      //
            // TODO: not supported in IE8 or below; add workaround
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

            // create our pusher object
            this.pusher = new Pusher('3fb8e3f49e89f2640bc9');

            // hook our collection into pusher
            this.messages.live({pusher:this.pusher, channel:'client-api', channelName:'client-api', log:true, eventType:'message'});

            // create Search view object once and maintain a reference to it
            this.searchPage = new SearchPage({model: this.messages, collection: this.messages });
        },

        selectItem: function(event) {
            $(event.target).addClass('tappable-active');
        },

        deselectItem: function(event) {
            $(event.target).removeClass('tappable-active');
        },

        // Standard List View (Fetches objects, passes the collection to listView which instantiates ListItemView and writes to template
        list: function () {

            // if this is first render then show the entire list
            if (this.firstRun) {

                this.firstRun = false;
                console.log('fetching entire collection from Server for first render.');
                
                // this will not work unless we wait for success and then act
                this.messages.fetch({wait: true});

                // TODO: store a collection in localstorage on first list in case connection is lost before a search can cache it
            }

            this.changePage(this.searchPage.render());
        },

        // Detail View fetches one model from the list and instantiates only the detail or list view passing single model to it
        detail: function (id) {
            if (this.viewRef) {
                console.log('killing zombie view (prev page) with id: ' + this.viewRef.cid);
                this.viewRef.close();
            }

            // get our single model from the collection by id
            this.message = App.messages.get(id);
            this.viewRef = new ItemPage({ model: this.message });
            this.changePage(this.viewRef.render());
        },

        // New View for adding a model to the collection from within the app
        add: function() {
            if (this.viewRef) {
                console.log('killing zombie view (prev page) with id: ' + this.viewRef.cid);
                this.viewRef.close();
            }

            // render a new view for posting messages
            this.viewRef = new NewPage({model: new Message(), collection: this.messages });
            this.changePage(this.viewRef.render());  // pass collection by reference
            window.console.log('new message added');
        },

        // takes care of all transitions setting css properties and appends the template to the DOM
        changePage: function (page) {
            var slideFrom,
                self = this;

            // if this is the first time the app runs then do some configuration
            if (this.firstTransition) {
                $(page.el).attr('class', 'page stage-center');
                this.content.append(page.el);
                this.currentPage = page;
                this.firstTransition = false;
                slideFrom = 'left';

                return;
            }

            // page object never has a slideFrom set at this point
            if (this.currentPage.slideFrom === '' || !this.currentPage.slideFrom) {
                slideFrom = 'right';
            }
            else {
                slideFrom = this.currentPage.slideFrom;
            }

            // Set the transition for the new page
            var slideClass = 'page stage-' + slideFrom;
            page.$el.attr('class', slideClass);

            console.log('Rendering ' + page.cid);

            this.content.append(page.el);

            // wait till page is appended then set the opposite transition for old page (currentPage) and slide one out and the other in
            setTimeout(function() {
                // Slide out the current page: If new page slides from the right -> slide current page to the left, and vice versa
                $(self.currentPage.el).attr('class', 'page transition ' + (slideFrom === "right" ? 'stage-left' : 'stage-right'));
                // Slide in the new page
                $(page.el).attr('class', 'page stage-center transition');
                self.currentPage = page;
            });
        }
    });

    window.App = new AppRouter();
    Backbone.history.start();

    // TODO: add localstorage capabilities to Live Collection Pusher and use something along the lines of
    // TODO: local or server and a syncASAP variables so that when pusher state is disconnected we go local
    // TODO: and set syncASAP = true; Then when back online sync and continue as normal

})(jQuery);


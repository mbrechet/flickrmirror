/**
 * route rendering object
 */
module.exports = function(app, Flickr, userdatadir) {
  var fs = require("fs");
  var setSize = 18;
  var ias = {};
  var names = {};

  /**
   * Find correct spelling for the username
   */
  var findSpelling = function(user) {
    if(names[user]) {
      return names[user];
    }
    names[user] = user;
    var dirs = fs.readdirSync(userdatadir);
    dirs.forEach(function(name) {
      if(name.toLowerCase() === user.toLowerCase()) {
        names[user] = name;
      }
    });
    return names[user];
  }

  /**
   * build a user's information architecture
   */
  var getIA = function(user) {
    if(ias[user]) {
      return ias[user];
    }
    var ia;
    if(!ias[user]) {
      var loc = userdatadir + "/" + user;
      ia = Flickr.loadLocally(loc);
      ias[user] = ia;
    }
    if(!ia.enrich) {
      ia.enrich = function(options) {
        var enriched = {};
        Object.keys(ia).forEach(function(key) {
          enriched[key] = ia[key];
        });
        Object.keys(options).forEach(function(key) {
          enriched[key] = options[key];
        });
        return enriched;
      };
    }
    return ia;
  };

  /**
   * Refresh a user's information architecture
   */
  var reloadIA = function(user) {
    delete ias[user];
    getIA(user);
  };

  /**
   * Multi-page pages like the photostream and set-views
   * require some "page" handling.
   */
  var buildOptions = function(req, container) {
    var page = parseInt(req.query.page,10) || 1,
        startpage = page - 1,
        start = startpage * setSize,
        endpage = page,
        end = endpage * setSize,
        lastpage = Math.ceil(container.length / setSize) | 0,
        navpages = [],
        n;
    for(n = Math.max(startpage-3,2); n<=Math.min(endpage+3,lastpage-1); n++) {
      navpages.push(n);
    }
    return {
      page: page,
      start: start,
      startpage: startpage,
      end: end,
      endpage: endpage,
      lastpage: lastpage,
      navpages: navpages
    };
  };

  var handler = {
    /**
     * Index page
     */
    index: function(req, res) {
      var ia = getIA(res.locals.userdir);
      var options = buildOptions(req, ia.photo_keys);

      (function buildCollectionThumbnails(){
        Object.keys(ia.collections).forEach(function(collection) {
          collection = ia.collections[collection];
          var thumbnails = [];
          var buildThumbnails = function(set) {
            set = ia.photosets[set.id];
            var photos = set.photos,
                len = photos.length,
                idx = (Math.random() * len) | 0;
            thumbnails.push(photos[idx]);
          };
          while(thumbnails.length < 12) {
            collection.set.forEach(buildThumbnails);
          }
          collection.thumbnails = thumbnails.slice(0,12);
        });
      }());
      res.render("index.html", ia.enrich(options));
    },

    /**
     * Photo view
     */
    photo: function(req, res) {
      var ia = getIA(res.locals.user);
      var photos = ia.photos,
          photo = photos[res.locals.photo],
          pos = ia.photo_keys.indexOf(photo.id),
          pkey = pos>0 ? pos-1 : false,
          nkey = pos<ia.photo_keys.length-1 ? pos +1 : false;
      if(pkey !== false) { photo.prev = photos[ia.photo_keys[pkey]]; }
      if(nkey !== false) { photo.next = photos[ia.photo_keys[nkey]]; }
      var viewsizes = {
            "b" : "large",
            "c" : "medium800",
            "z" : "medium",
            "o" : "original",
          },
          viewkeys = Object.keys(viewsizes),
          viewsize;
      for(var v=0; v<4; v++) {
        viewsize = viewkeys[v];
        if(photo.sizes.indexOf(viewsize) > -1) {
          photo.viewsize = viewsizes[viewsize];
          break;
        }
      }
      res.render("dedicated_photo.html", ia.enrich({
        photo: photo
      }));
      delete ia.photo;
    },

    /**
     * Photo lightbox view
     */
    lightbox: function(req, res) {
      var ia = getIA(res.locals.user);
      var photos = ia.photos,
          photo = photos[res.locals.photo];
      res.render("lightbox.html", ia.enrich({
        photo: photo
      }));
      delete ia.photo;
    },

    /**
     * Set view
     */
    set: function(req, res) {
      var ia = getIA(res.locals.user);
      var photosets = ia.photosets,
          photoset = photosets[res.locals.set],
          options = buildOptions(req, photoset.photos);
      options.photoset = photoset;
      res.render("dedicated_set.html", ia.enrich(options));
      delete ia.photoset;
    },

    /**
     * Collection view
     */
    collection: function(req, res) {
      var ia = getIA(res.locals.user);
      var collections = ia.collections,
          collection = collections[res.locals.collection];
      res.render("dedicated_collection.html", ia.enrich({
        collection: collection
      }));
      delete ia.collection;
    },

    reload: function(req, res) {
      reloadIA(res.locals.user);
      return handler.index(req, res);
    },

    /**
     * set up URL routing
     */
    parameters: (function(app) {
      app.param("user", function(req, res, next, user) {
        res.locals.userdir = user;
        res.locals.user = findSpelling(user);
        next();
      });

      ["photo", "set", "collection"].forEach(function(param) {
        app.param(param, function(req, res, next, value) {
          res.locals[param] = value;
          next();
        });
      });
    }(app))
  };

  return handler;
};

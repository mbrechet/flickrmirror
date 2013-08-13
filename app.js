var argv = (function() {
      var argv = require("argv");
      argv.option({
          name: 'downsync',
          short: 'ds',
          type: 'boolean',
          description: 'Download all photos and information architecture from Flickr',
          example: "'script --downsync"
      });
      return argv.run().options;
  	}()),
  	env = (function(){
      var Habitat = require("habitat");
      Habitat.load();
      return new Habitat();
    }()),
    express = require("express"),
    expressApp = express(),
    nunjucks = (function(express) {
      var  nunjucks = require("nunjucks"),
          fsl = new nunjucks.FileSystemLoader('views'),
          env = new nunjucks.Environment(fsl);
      env.express(expressApp);
      return env;
    }(express)),
    stylus = require("stylus"),
    Flickr = require("flickrapi");

// Authenticate with flickr and then download everything.
if(argv.downsync) {
  return Flickr.authenticate(env.get("flickr"), Flickr.downsync);
}

// No downsync: run server using IA
var app = expressApp;
app.disable('x-powered-by');
app.use(express.compress());
app.use(express.bodyParser());
app.use(express.cookieParser());
app.use(express.methodOverride());
app.use(stylus.middleware({ src: "./public" }));
app.use(express.static("public"));
app.use(express.static("data"));

// server routes
var routes = require("./routes")(app, Flickr.loadLocally());
app.get('/', routes.index);
app.get('/photos/:photo', routes.photo);
app.get('/sets/:set', routes.set);
app.get('/collections/:collection', routes.collection);

// start listening
app.listen(3000, function(err) {
  console.log("Node server listening on http://127.0.0.1:3000");
})

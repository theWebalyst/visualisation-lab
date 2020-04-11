// Classes interfacing with external data sources
//
// TODO: remove all console.dir

import {modelFormats} from '../modelFormats.js';

/** Base class for interfaces to different kinds of data source (file, database, web) 
 */
 class SourceInterface {
  constructor (shortName, description, uiComponent, options) {
    this.shortName = shortName;
    this.description = description;
    this.uiComponent = uiComponent;
    this.options = options;

    this.sourceResult = undefined;  // A subclass of SourceResult
  }
  
  // Base interface:
  setSourceResult (sourceResult) {this.sourceResult = sourceResult;}
  getSourceResult () {return this.sourceResult;}

  consumeRdfStream (sourceResultStore, statusTextStore, stream, {mimeType, size}) {
    const sourceResult = new SourceResult(this);
    return sourceResult.consumeRdfStream(sourceResultStore, statusTextStore, stream, {mimeType, size});
  }
  consumeRdfTextTtl (sourceResultStore, statusTextStore, textTtl) {
    const sourceResult = new SourceResult(this);
    return sourceResult.consumeRdfTextTtl(sourceResultStore, statusTextStore, textTtl);
  }
  consumeCsvText (sourceResultStore, statusTextStore, csvText, options) {
    if (options === undefined) options = {};
    const sourceResult = new SourceResult(this);
    return sourceResult.consumeCsvText(sourceResultStore, statusTextStore, csvText, options);
  }
  consumeJson (sourceResultStore) {
    const sourceResult = new SourceResult(this);
    return sourceResult.consumeJson(sourceResultStore);
  }
  loadFiles(sourceResultStore, statusTextStore, fileList, options) {
    const sourceResult = new SourceResult(this);
    return sourceResult.loadFiles(sourceResultStore, statusTextStore, fileList, options);
  }
  loadUri(sourceResultStore, statusTextStore, uri) {
    const sourceResult = new SourceResult(this);
    return sourceResult.loadUri(sourceResultStore, statusTextStore, uri);
  }
  loadSparqlQuery(sourceResultStore, statusTextStore, endpoint, sparqlText) {
    const sourceResult = new SourceResult(this);
    return sourceResult.loadSparqlQuery(sourceResultStore, statusTextStore, endpoint, sparqlText);
  }
  consumeCsvStream (sourceResultStore, statusTextStore, stream, {mimeType, size}) {
    const sourceResult = new SourceResult(this);
    return sourceResult.consumeCsvStream(sourceResultStore, statusTextStore, stream, {mimeType, size});
  }
  consumeTextStream (sourceResultStore, statusTextStore, stream, {mimeType, size}) {
    const sourceResult = new SourceResult(this);
    return sourceResult.consumeTextStream(sourceResultStore, statusTextStore, stream, {mimeType, size});
  }

  // TODO: review the following...
  // TODO: maintain named, id'd list of all SourceInterface objects for SourceUI
  // TODO: start with four fixed interfaces: 
  // DONE:  - RDF (fixed LDP access)
  // DONE:  - SPARQL (specify endpoint and create query with some presets)
  // DONE:  - File (a fixed file)
  // TODO:  - Manual (fixed user)
  // TODO:  - Generated (ngraph)
  // TODO: add serialisation (file save/load and incorporate in app-wide project/template serialisation)
  // TODO: add UI for create, copy and edit SourceInterface (and in each subclass UI component)

}

export class SourceInterfaceManager {
  constructor (interfaceDefinitions) {    
    this.initialiseInterfaces(interfaceDefinitions !== undefined ? interfaceDefinitions : testInterfaces);
  }

  // TODO: add ability to add/remove/edit/enumerate SourceInterfaces

  ////////////////////////////////
  
  initialiseInterfaces (interfaceDefinitions) {
    console.log('SourceInterfaceManager.initialiseInterfaces()...');
    this.sourceInterfaces = new Map;
    
    interfaceDefinitions.forEach(def => {
      try {
        let newInterface
        if (def.uiClass)
          newInterface = new SourceInterface(def.shortName, def.description, def.uiClass, def.options);

        this.sourceInterfaces.set(def.shortName, newInterface);
        console.dir(newInterface);
      } catch(e) {
        console.warn(e);
        window.notifications.notifyWarning(e);
      }
    });    
  }

}

// Application UIs:
import FileUI from './FileUI.svelte';
import WebUI from './WebUI.svelte';
import WebSparqlUI from './WebSparqlUI.svelte';
import WebQueryUI from './WebQueryUI.svelte';
import WebSourceTabulatorUI from './WebSourceTabulatorUI.svelte';

// Test UIs:
// import ManualUI from "./ManualUI";
// import GeneratorUI from "./GeneratorUI";
import JsonUI from "./JsonUI.svelte";
import TestRdfUI from "./TestRdfUI.svelte";
import TestCsvUI from "./TestCsvUI.svelte";
import lesMisData from '../data/data-les-miserables.js';

// RDF Support
const ttlReader = require('@graphy/content.ttl.read');
const RdfDataset = require('@graphy/memory.dataset.fast');

// CSV Support
// import {parser as csvParse} from 'csv-parse';
const csvParse = require('csv-parse');

/** Load multiple external data formats into a JSON ViewModel representation
 * 
 * The set of ViewModel representations is defined in modelFormats.js
 */
export const fetchStatus = {
  IDLE: 'source-result-idle',
  FETCHING: 'source-result-fetching',
  RESPONSE: 'source-result-response', // SourceResult.response waiting to be consumed
  COMPLETE: 'source-result-complete', // Response has been consumed
  FAILED: 'source-result-failed',     // Failed without response (e.g. blocked by CORS)
};
export class SourceResult {
  constructor (sourceInterface) {
    this.sourceInterface = sourceInterface;
    this.fetchStatus = fetchStatus.IDLE;
  }

  // Status allows handling of errors by subscribers to the sourceResultStore
  fetchStarting () { this.response = undefined; this.fetchStatus = fetchStatus.FETCHING; }
  fetchResponded (response) { this.response = response; this.fetchStatus = fetchStatus.RESPONSE; }
  fetchAbandoned () { this.fetchStatus = fetchStatus.FAILED; }
  getFetchStatus () { return this.fetchStatus; }
  consumeFetchResponse () { 
    const result = this.response; 
    this.fetchStatus = fetchStatus.COMPLETE; 
    this.response = undefined; 
    return result;
  }

  getSourceInterface () {return this.sourceInterface;}
  getRdfDataset () {return this.getJsonModelFormat() === modelFormats.RAW_RDFDATASET ? this.getJsonModelValues() : undefined;}
  getFormatsConsumed () {return [
    modelFormats.RAW_STREAM_RDF, 
    modelFormats.RAW_TEXT_TURTLE,
    modelFormats.RAW_JSON_ARRAY,
  ];}
    
  setJsonModel (jsonModel) {this.jsonModel = jsonModel;}
 
  getJsonModel () {return this.jsonModel;}
  getJsonModelFormat () {return this.jsonModel ? this.jsonModel.modelFormat : modelFormats.UNDEFINED; }
  getJsonModelValues () {return this.jsonModel ? this.jsonModel.values : undefined;}

  // import fetch from '@rdfjs/fetch';
  
  // const label = 'https://www.w3.org/2000/01/rdf-schema#label'
  
  // fetch('https://www.w3.org/2000/01/rdf-schema')
  //   .then(res => res.dataset())
  //   .then(dataset => {
  //     for (const quad of dataset) {
  //       if (quad.predicate.value === label) {
  //         console.log(`${quad.subject.value}: ${quad.object.value}`)
  //       }
  //     }
  //   }).catch(err => console.error(err));
  
  // TODO: Unify data consumption and move to ViewModel:
  // TODO: - extend MIME type support using graphy reader based on mimeType
  consumeRdfStream (sourceResultStore, statusTextStore, stream,  {mimeType, size}) {
    console.log('SourceResult.consumeRdfFile()');
    console.dir(stream);
    console.log('Size: ', size);
    this.sourceResultStore = sourceResultStore;
    
    try {
      const rdfDataset = RdfDataset();
      const self = this;
      const graphyReader = ttlReader({
        data (y_quad) {
          rdfDataset.add(y_quad);
          if (statusTextStore) statusTextStore.set(rdfDataset.size + ' triples loaded');
        },
        eof () {
          console.log('done!');
          console.log('rdfDataset size: ', rdfDataset.size);
          self.setJsonModel({values: rdfDataset, modelFormat: modelFormats.RAW_RDFDATASET});
          self.sourceResultStore.update(v => self);
          },
        error (e) {
          // window.notifications.notifyWarning('Failed to parse RDF result.')
          console.log('error: ', e);
          console.log('rdfDataset size: ', rdfDataset.size);
          self.setJsonModel(undefined);
          self.sourceResultStore.update(v => self);
          }
        });
        readableStreamToGraphyReader(stream, graphyReader);
      // The above code allows me to use whatwg (browser) streams with graphy.
      // When graphy adds whatwg streams the following can be used instead (issue #20).
      // const rdfDataset = RdfDataset(); 
      // const self = this;
      // file.stream().pipeTo(ttlReader())
      // .on('data', (y_quad) => {
      //     console.log(JSON.stringify(y_quad));
      //     rdfDataset.add(y_quad);
      //     console.log('rdfDataset size: ', rdfDataset.size);
      //   })
      //   .on('eof', () => {
      //     console.log('done!');
      //     console.log('rdfDataset size: ', rdfDataset.size);
      //     let sourceResult = new RdfSourceResult(this, rdfDataset);
      //     self.setSourceResult(sourceResult);
      //     self.sourceResultStore.update(v => sourceResult);

      //     console.log('loadTestRdf() results: ');
      //     console.dir(self.$sourceResultStore);
      // });
    } catch(e) {
      console.error(e);
      window.notifications.notifyWarning('Failed to parse RDF result.')
    }
  }

  consumeRdfTextTtl (sourceResultStore, statusTextStore, textTtl) {
    console.log('SourceResult.consumeRdfTextTtl()');
    this.sourceResultStore = sourceResultStore;

    try {
      const rdfDataset = RdfDataset();
      const self = this;
      ttlReader(textTtl, {
        data(y_quad) {
          console.log(JSON.stringify(y_quad));
          rdfDataset.add(y_quad);
          if (statusTextStore) statusTextStore.set(rdfDataset.size + ' triples loaded');
        },
  
        eof(h_prefixes) {
          console.log('done!');
          console.log('rdfDataset size: ', rdfDataset.size);
          self.setJsonModel({
            values: rdfDataset, 
            modelFormat: modelFormats.RAW_RDFDATASET,  
            sourceInterface: this,
          });
          self.sourceResultStore.update(v => self);
        },
        error (e) {
          // window.notifications.notifyWarning('Failed to parse RDF text.')
          console.log('error: ', e);
          console.log('rdfDataset size: ', rdfDataset.size);
          self.setJsonModel(undefined);
          self.sourceResultStore.update(v => self);
          }
      })
    } catch (e) { 
      console.error(e); 
      window.notifications.notifyWarning(e);
    } 

  }

  // JSON - initially just {nodes: [], links []}
  // TODO add a ViewModel type param so any ViewModel can be loaded as JSON (e.g. from file)
  consumeJson (sourceResultStore) {
    console.log('SourceResult.consumeJson()');
    this.sourceResultStore = sourceResultStore;

    this.setJsonModel({values: lesMisData, modelFormat: modelFormats.VM_GRAPH_JSON});
    this.sourceResultStore.update(v => this);
  }

  consumeCsvText (sourceResultStore, statusTextStore, csvText, {mimeType, size, stringToNumber}) {
    console.log('SourceResult.consumeCsvText()');
    this.sourceResultStore = sourceResultStore;
    try {
      const self = this;
      const csvJson = [];
      let records = 1;
      if (statusTextStore) statusTextStore.set('loading CSV...');
      const parser = csvParse();
      parser.on('readable', function(){
        let record
        while (record = parser.read()) {
          // console.log('READ: ' + record);
          if (stringToNumber) {
            record.forEach((v,i,a) => {if (!isNaN(Number(v))) a[i] = Number(v);});
          }
          csvJson.push(record)
          if (statusTextStore) statusTextStore.set(records++ + ' records loaded');
        }
      })
      parser.on('error', function(err){
        throw(err);
      })
      parser.on('end', function(){
        if (statusTextStore) statusTextStore.set(records + ' records loaded');
        self.setJsonModel({values: csvJson, modelFormat: modelFormats.VM_TABULAR_JSON});
        self.sourceResultStore.update(v => self);
      })
      // Pass the text to the parser
      csvText.split('\n').forEach(line => {
        if (line.length > 0) parser.write(line + '\n')
      });
      // console.log('END');
      parser.end();
    } catch(e) {
      console.dir(e);
      // console.error(e);
      window.notifications.notifyWarning('Failed to parse CSV result.')
      return;
    }
  }

  // TODO: a consumeStream() which uses the options.mimeType param to choose the consume function
  consumeCsvStream (sourceResultStore, statusTextStore, stream, {mimeType, size, stringToNumber}) {
    console.log('SourceResult.consumeCsvStream)');
    console.dir(stream);
    console.log('Size: ', size);
    this.sourceResultStore = sourceResultStore;
    try {
      const self = this;
      const csvJson = [];
      let records = 1;
      if (statusTextStore) statusTextStore.set('loading CSV...');
      const parser = csvParse();
      parser.on('readable', function(){
        let record
        while (record = parser.read()) {
          if (stringToNumber) {
            record.forEach((v,i,a) => {if (!isNaN(Number(v))) a[i] = Number(v);});
          }
          csvJson.push(record)
          if (statusTextStore) statusTextStore.set(records++ + ' records loaded');
        }
      })
      parser.on('error', function(err){
        throw(err);
      })
      parser.on('end', function(){
        if (statusTextStore) statusTextStore.set(records + ' records loaded');
        self.setJsonModel({values: csvJson, modelFormat: modelFormats.VM_TABULAR_JSON});
        self.sourceResultStore.update(v => self);
      })
      readableStreamToConsumer(stream, parser);
    } catch(e) {
      console.dir(e);
      // console.error(e);
      window.notifications.notifyWarning('Failed to parse CSV result.')
      return;
    }
  }

  // TODO: a consumeStream() which uses the options.mimeType param to choose the consume function
  consumeTextStream (sourceResultStore, statusTextStore, stream, {mimeType, size, stringToNumber}) {
    console.log('SourceResult.consumeTextStream)');
    console.dir(stream);
    console.log('Size: ', size);
    this.sourceResultStore = sourceResultStore;
    try {
      this.sourceResultStore.set(stream)
      const self = this;
      const csvJson = [];
      let records = 1;
      if (statusTextStore) statusTextStore.set('loading CSV...');
      const parser = csvParse();
      parser.on('readable', function(){
        let record
        while (record = parser.read()) {
          if (stringToNumber) {
            record.forEach((v,i,a) => {if (!isNaN(Number(v))) a[i] = Number(v);});
          }
          csvJson.push(record)
          if (statusTextStore) statusTextStore.set(records++ + ' records loaded');
        }
      })
      parser.on('error', function(err){
        throw(err);
      })
      parser.on('end', function(){
        if (statusTextStore) statusTextStore.set(records + ' records loaded');
        self.setJsonModel({values: csvJson, modelFormat: modelFormats.VM_TABULAR_JSON});
        self.sourceResultStore.update(v => self);
      })
      readableStreamToConsumer(stream, parser);
    } catch(e) {
      console.dir(e);
      // console.error(e);
      window.notifications.notifyWarning('Failed to parse CSV result.')
      return;
    }
  }

  /** Load and parse files into a SourceResult store 
   * 
   * Currently assumes RDF input
   * TODO: LATER: provide file selection with optional default file extensions (use 'options' in the interfaces list)
   *
   * File system interface (for loading local files)
   * Uses FileAPI: https://w3c.github.io/FileAPI
   * Examples: https://www.javascripture.com/FileReader
   * 
   * @param {Writeable<SourceResult>} sourceResultStore 
   * @param {FileList} fileList 
   * @param {Object}  current options: {mimeType: String}
   */
  loadFiles(sourceResultStore, statusTextStore, fileList, options) {
    console.log('SourceResult.loadFiles()');

    // TODO: load multiple files into same store
    // TODO: consider loading multiple files into separate stores/views
    const file = fileList[0]
    if (file !== undefined) {
      if (statusTextStore) statusTextStore.set('loading file(s)');
      try {
        console.log('Loading ', file.size, ' bytes from ', file);
        let mimeType = file.type;
        if (mimeType === undefined) mimeType = options.mimeType ? options.mimeType : undefined;

        const options = {stringToNumber: true, mimeType: file.type, size: file.size};
        if (mimeType === 'text/csv')
          this.consumeCsvStream(sourceResultStore, statusTextStore, file.stream(), options);
        else  // Default to RDF
          this.consumeRdfStream(sourceResultStore, statusTextStore, file.stream(), options);
      } catch(e) {
        console.warn(e);
        window.notifications.notifyWarning('File load error');
      }
    } else {
      console.warn('No file selected.');
    }
    if (statusTextStore) statusTextStore.set('');
  }

  /** Fetch RDF from a web URI and parse the result 
   * 
   * @param {Writeable<SourceResult>} sourceResultStore 
   * @param {String} URI 
   */
  loadUri(sourceResultStore, statusTextStore, uri) {
    console.log('SourceResult.loadUri(' + uri + ')');

    // TODO: load multiple URIs into same store
    // TODO: consider loading multiple URIs into separate stores/views
      
    // Note: firefox with Privacy Badger gives CORS errors when fetching different origin (URI)
    if (statusTextStore) statusTextStore.set('loading data');
    this.fetchStarting();
    fetch(uri, {
      method: 'GET',
      cache: "reload",
      pragma: "no-cache",
      // mode: 'no-cors', // Last examples-sparql.js query not working, this doesn't help
                       // Won't help because response content blocked by browser in opaque response
                       // See: https://stackoverflow.com/a/54906434/4802953
      headers: {
        // Need to avoid CORS Pre-flight checks, so avoid
        // adding headers that will trigger them:
        // See 'Simple Requests' at https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

        'Accept': 'text/turtle', // Needed for SPARQL endpoints that return JSON by default
        // 'Accept': 'application/sparql-results+json',
        // 'Cache-Control': 'no-cache',
      }})
    .then(response => {
      this.fetchResponded(response);
      if (response.ok ) {
        const contentLength = (response.headers.get('Content-Length'));
        if (response.headers.get('Content-Type').startsWith('text/csv'))
          this.consumeCsvStream(sourceResultStore, statusTextStore, response.body, {size: contentLength});
        else
          this.consumeRdfStream(sourceResultStore, statusTextStore, response.body, {size: contentLength});
      } else {
        const warning = 'Failed to load URI.\n' + response.statusText;
        console.dir(response);
        console.warn(warning);
        window.notifications.notifyWarning(warning);
      }
      if (statusTextStore ) statusTextStore.set('');
    })
    .catch(e => {
      console.error(e);
      window.notifications.notifyWarning('Query failed.');
      window.notifications.notifyError(e.message);
      this.fetchAbandoned();
      sourceResultStore.update(v => this);
    });
  }

  /** Fetch text from a web URI 
   * 
   * @param {Writeable<SourceResult>} sourceResultStore 
   * @param {String} URI 
   * 
   * TODO rationalise this with loadUri() only difference is Accept header and consumeTextStream()
   */
  loadUriAsText(sourceResultStore, statusTextStore, uri) {
    console.log('SourceResult.loadUriAsText(' + uri + ')');

    // Note: firefox with Privacy Badger gives CORS errors when fetching different origin (URI)
    statusTextStore.set('loading');
    this.fetchStarting();
    fetch(uri, {
      method: 'GET',
      cache: "reload",
      pragma: "no-cache",
      // mode: 'no-cors', // Last examples-sparql.js query not working, this doesn't help
      headers: {
        // Need to avoid CORS Pre-flight checks, so avoid
        // adding headers that will trigger them:
        // See 'Simple Requests' at https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

        // 'Accept': 'text/text', // Needed for SPARQL endpoints that return JSON by default
        'Accept': 'text/turtle',
        // 'Accept': 'application/sparql-results+json',
        // 'Cache-Control': 'no-cache',
      }})
    .then(response => {
      this.fetchResponded(response);
      if (response.ok ) {
        console.log('RESPONSE:');console.dir(response);
        console.log('Content-Type:' + response.headers.get('Content-Type'))
        const contentLength = (response.headers.get('Content-Length'));
        if (response.headers.get('Content-Type').startsWith('text/xcsv')) {
          this.consumeCsvStream(sourceResultStore, statusTextStore, response.body, {size: contentLength});
        }
        else if (response.headers.get('Content-Type').startsWith('text')) {
          statusTextStore.set(contentLength + ' characters loaded'); 
          response.text().then(text => sourceResultStore.set(text));
        } 
        else {
          this.consumeRdfStream(sourceResultStore, statusTextStore, response.body, {size: contentLength});
        }
      } else {
        const warning = 'Failed to load URI.\n' + response.statusText;
        console.warn(warning);
        window.notifications.notifyWarning(warning);
      }
      statusTextStore.set('');
    })
    .catch(e => {
      console.error(e);
      window.notifications.notifyWarning('Query failed.');
      window.notifications.notifyError(e.message);
      statusTextStore.set('');
      this.fetchAbandoned();
      sourceResultStore.update(v => this);
    });
  }

  loadSparqlQuery(sourceResultStore, statusTextStore, endpoint, sparqlText) {
    console.log('SourceResult.loadSparqlQuery()');
    if (endpoint === '') {
      console.warn('No endpoint provided');
      window.notifications.notifyWarning('Please provide an endpoint');
      return;
    }
    var url = endpoint + "?query=" + encodeURIComponent(sparqlText);// + "&type='text/turtle'";
    console.log('loadSparqlQuery()');
    console.log(url);
    return this.loadUri(sourceResultStore, statusTextStore, url);
  }

  loadSparqlQueryAsText(sourceResultStore, statusTextStore, endpoint, sparqlText) {
    console.log('SourceResult.loadSparqlQuery()');
    if (endpoint === '') {
      console.warn('No endpoint provided');
      window.notifications.notifyWarning('Please provide an endpoint');
      return;
    }
    var url = endpoint + "?query=" + encodeURIComponent(sparqlText) + "&type='text'";
    console.log('loadSparqlQueryAsText()');
    console.log(url);
    return this.loadUriAsText(sourceResultStore, statusTextStore, url);
  }
}

function readableStreamToConsumer(readableStream, consumer) {
  const bodyReader = readableStream.getReader();

  function next () {
    bodyReader.read().then(readChunk);
  }

  function readChunk ({value, done}) {
    if (done) {
      consumer.end();
      return;
    }

    consumer.write(value);
    next();
  }

  next();
}

// TODO deprecate in favour of readableStreamToConsumer()
function readableStreamToGraphyReader(readableStream, graphyReader) {
  const bodyReader = readableStream.getReader();

  function next () {
    bodyReader.read().then(readChunk);
  }

  function readChunk ({value, done}) {
    if (done) {
      graphyReader.end();
      return;
    }

    graphyReader.write(value);
    next();
  }

  next();
}

/** Classes to collect data about a SPARQL endpoint for use in understanding its extent and contents

There's a SparqlStat class to handle simple result types such as number and text, and
subclasses to handle more complex results such as a tree of ViewModels (for drill down type UI).

A SparqlStat typically runs a query to gather data which it stores as a SourceResult, and
publishes this by updating the store which refers back to itself.

Options may be provided to customise behaviour, and are available to any associated UI components 
to customise their behaviour.

*/

import {writable} from 'svelte/store';

export class SparqlStat extends SourceResult {
  constructor (config) {
    super(null); // SparqlStat has source URI in config, does not use a SourceInterface

    this.config = config;
    this.statusText = '-';
    this.statusTextStore = writable(this.statusText);
    this.resultStore = writable(this);
    this.resultText = '-';
  }

  getStatusTextStore () { return this.statusTextStore; }
  setStatusText (statusText) { this.statusText = statusText; this.statusTextStore.set(statusText); }
  getStatusText () { return this.statusText; }

  setResultText (resultText) { this.resultText = resultText; this.resultStore.update(v => this);}
  getResultText () { return String(this.resultText); }
  setResultNumber (resultNumber) { this.resultNumber = resultNumber; this.resultStore.update(v => this);}
  getResultNumber () { return Number(this.resultNumber); }

  updateSparqlStat () {
    this.loadSparqlQueryAsText(this.resultStore, this.statusTextStore, this.config.endpoint, this.config.query);
  }
}

/** Specialist class to determine SPARQL version and capabilities
 * 
 */
// import {SparqlEndpointStat} from '../rdf/rdfUtils.js';

export class SparqlEndpointStat extends SparqlStat {
  constructor (config) {
    super(config);
    console.log('NEW SparqlEndpointStat has config.source.endpoint: ' + this.config.source.endpoint);
    this.serviceInfoStore = writable(this);  // Use a second store for interim result (Service Description)
    this.serviceInfo = {
      version: '-',
    };

    const self = this;
    function _updateResultStore (serviceInfoDataset) {
      console.log('xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
      console.log('self.config.source.endpoint: ' + self.config.source.endpoint);
      console.log('SparqlEndpointStat._updateResultStore()'); console.dir(self);
      console.log('fetch status; ' + self.getFetchStatus());
      if (self.getFetchStatus() === fetchStatus.FAILED) {
        // The fetch failed without a response (e.g. blocked by CORS)
        self.setStatusText('failed');
        self.serviceInfo = {
          version: 'unknown',
        };
      } else if (serviceInfoDataset && serviceInfoDataset.jsonModel) {
        // Request for service description worked suggests v1.1 but service
        // descriptions are not reliable so we don't trust/use what it says
        const dataset = serviceInfoDataset.jsonModel.values;
        console.log('serviceInfo dataset:'); console.dir(dataset);
        self.setStatusText('done');
        // TODO: could extract info from service description (dataset) here
        self.serviceInfo = {
          version: '1.1 (inferred)',
        };
      } else if (self.getFetchStatus() === fetchStatus.COMPLETE) {
        // The fetch completed but the response was not understood
        const response = self.consumeFetchResponse();
        console.log('Unable to obtain service description');
        console.log('response:'); console.dir(response);
        self.setStatusText('done');
        self.serviceInfo = {
          version: '1.0 (inferred)',
        };      
      } else if (self.getFetchStatus() === fetchStatus.RESPONSE) {
        // The fetch completed but the response was not consumed
        const response = self.consumeFetchResponse();
        console.log('Unable to obtain service description');
        console.log('response:'); console.dir(response);
        self.setStatusText('done');
        self.serviceInfo = {
          version: '1.0 (inferred)',
        };      
      }
      self.setResultText('SPARQL version: ' + self.serviceInfo.version);
    }

    this.unsubscribe = this.serviceInfoStore.subscribe(_updateResultStore);
  }

  updateSparqlStat () {
    console.log('SparqlEndpointStat.update()');
    this.setStatusText('working..');
    this.loadUri(this.serviceInfoStore, undefined, this.config.source.endpoint, this.config.query)
  }
}

// TODO: replace fixed interfaces with an initial set
// TODO: change uiClass to String and use a 'factory' so I can serialise (research ways to serialise first)
const testInterfaces = [
  // Test UIs
  {uiClass: WebSourceTabulatorUI, shortName: "rdf-source-tabulator", description: "Tabulate SPARQL Endpoints", options: {}},
  {uiClass: WebQueryUI, shortName: "rdf-query-sparql", description: "Query Semantic Data Stores", options: {}},
  {uiClass: WebUI, shortName: "test-dbpedia-cnut", description: "Test Cnut dbPedia SPARQL Query", options: {fixedUri: 'http://dbpedia.org/sparql/?query=PREFIX+dbo%3A+<http%3A%2F%2Fdbpedia.org%2Fontology%2F>%0D%0APREFIX+dbpedia2%3A+<http%3A%2F%2Fdbpedia.org%2Fproperty%2F>%0D%0ACONSTRUCT+{%0D%0A++%3Fsubject+rdf%3Atype+foaf%3APerson+.%0D%0A++%3Fsubject+rdf%3Atype+%3Ftypes+.%0D%0A++%3Fsubject+rdfs%3Alabel+%3Flabel+.%0D%0A++%3Fsubject+foaf%3AgivenName+%3FgivenName+.%0D%0A++%3Fsubject+foaf%3Asurname+%3Fsurname+.%0D%0A++%3Fsubject+foaf%3Agender+%3Fgender+.%0D%0A++%3Fsubject+dbo%3AbirthDate+%3FbirthDate+.%0D%0A++%3Fsubject+dbo%3AdeathDate+%3FdeathDate+.%0D%0A++%3Fsubject+foaf%3Ahomepage+%3Fhomepage+.%0D%0A++%3Fsubject+dbpedia2%3Aoccupation+%3Foccupation+.%0D%0A++%3Fsubject+foaf%3Adepiction+%3Fdepiction+.%0D%0A++%3Fsubject+dbo%3Athumbnail+%3Fthumbnail+.%0D%0A++%3Fsubject+dbo%3Achild+%3Fchild+.%0D%0A++%3Fsubject+dbo%3Aparent+%3Fparent+.%0D%0A++%3Fsubject+dbo%3Aspouse+%3Fspouse+.%0D%0A++%3Fsubject+foaf%3Agender+%3Fgender+.%0D%0A++%3FpersonReferringToParent+dbo%3Aparent+%3Fsubject+.%0D%0A++%3FpersonReferringToChild+dbo%3Achild+%3Fsubject+.%0D%0A++%3FpersonReferringToSpouse+dbo%3Aspouse+%3Fsubject+.%0D%0A++%3Fsubject+rdfs%3Acomment+%3Fcomment+.%0D%0A}%0D%0AWHERE+{%0D%0A++{%0D%0A%09%3Fsubject+rdf%3Atype+foaf%3APerson+.%0D%0A%09FILTER+(+%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FCnut_the_Great>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FSigrid_the_Haughty>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FEmma_of_Normandy>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FHarthacnut>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FGunhilda_of_Denmark>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2F%25C3%2586lfgifu_of_Northampton>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FHarold_Harefoot>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FGunhild_of_Wenden>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FEmma_of_Normandy>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2F%25C3%2586lfgifu_of_Northampton>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FSvein_Knutsson>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FThurbrand_the_Hold>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2F%25C5%259Awi%25C4%2599tos%25C5%2582awa>+||%0D%0A%09++%3Fsubject+%3D+<http%3A%2F%2Fdbpedia.org%2Fresource%2FSweyn_Forkbeard>%0D%0A%09)%0D%0A%0D%0A%09OPTIONAL+{+%3Fsubject+rdf%3Atype+%3Ftypes+.+%0D%0A%09++FILTER(+%3Ftypes+%3D+<http%3A%2F%2Fdbpedia.org%2Fclass%2Fyago%2FAristocrat109807754>+||+%3Ftypes+%3D+<http%3A%2F%2Fdbpedia.org%2Fclass%2Fyago%2FRuler110541229>+)%0D%0A%09}%0D%0A%09OPTIONAL+{+%3Fsubject+rdfs%3Alabel+%3Flabel+.+FILTER+langMatches(+lang(%3Flabel)%2C+"en"+)+}%0D%0A%09OPTIONAL+{+%3Fsubject+foaf%3AgivenName+%3FgivenName.+FILTER+langMatches(+lang(%3FgivenName)%2C+"en"+)+}%0D%0A%09OPTIONAL+{+%3Fsubject+foaf%3Asurname+%3Fsurname+.+FILTER+langMatches(+lang(%3Fsurname)%2C+"en"+)+}%0D%0A%09OPTIONAL+{+%3Fsubject+foaf%3Agender+%3Fgender+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+dbo%3AbirthDate+%3FbirthDate+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+dbo%3AdeathDate+%3FdeathDate+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+foaf%3Ahomepage+%3Fhomepage+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+dbpedia2%3Aoccupation+%3Foccupation+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+foaf%3Adepiction+%3Fdepiction+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+dbo%3Athumbnail+%3Fthumbnail+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+dbo%3Achild+%3Fchild+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+dbo%3Aparent+%3Fparent+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+dbo%3Aspouse+%3Fspouse+.+}%0D%0A%09OPTIONAL+{+%3FpersonReferringToParent+dbo%3Aparent+%3Fsubject+.+}%0D%0A%09OPTIONAL+{+%3FpersonReferringToChild+dbo%3Achild+%3Fsubject+.+}%0D%0A%09OPTIONAL+{+%3FpersonReferringToSpouse+dbo%3Aspouse+%3Fsubject+.+}%0D%0A%09OPTIONAL+{+%3Fsubject+rdfs%3Acomment+%3Fcomment+.+%0D%0A%09++FILTER+langMatches(+lang(%3Fcomment)%2C+"en"+)%0D%0A%09}%0D%0A++}%0D%0A}'}},
  {uiClass: WebUI, shortName: "test-web-csv", description: "Test WHO latest CSV data (Covid19 total_deaths.csv)", options: {fixedUri: 'https://covid.ourworldindata.org/data/ecdc/total_deaths.csv'}},
  {uiClass: JsonUI, shortName: "json-test", description: "Test JSON (Les Miserables)", options: {}},
  {uiClass: TestRdfUI, shortName: "rdf-test", description: "Test RDF/Turtle file (LOD Cloud)", options: {}},
  // {uiClass: ManualUI, shortName:  "manual-test", description: "Manual (mrh)", options: {}},
  // {uiClass: GeneratorUI, shortName:  "generator-test", description: "Generator (mrh)", options: {}},

  // Application interface UIs
  {uiClass: WebSparqlUI, shortName: "rdf-sparql", description: "SPARQL Query", options: {}},
  {uiClass: WebUI, shortName: "rdf-ldp", description: "Web resource (LDP RDF/Turtle, CSV file)", options: {}},
  {uiClass: FileUI, shortName: "file", description: "Local file (RDF/Turtle, CSV)", options: {}}, 
  {uiClass: TestCsvUI, shortName: "test-csv", description: "Test local CSV file (WHO Covid19 total_cases.csv)", options: {fixedFile: '~/visualisation/datasets/covid19/total_cases.csv'}},
 ];


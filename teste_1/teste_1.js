angular.module('teste_1App', ['snk']).controller('teste_1Controller', ['SkApplication', 'i18n', 'ObjectUtils', 'MGEParameters', 'AngularUtil', 'StringUtils', 'ServiceProxy', 'MessageUtils', 'SanPopup',
   function(SkApplication, i18n, ObjectUtils, MGEParameters, AngularUtil, StringUtils, ServiceProxy, MessageUtils, SanPopup) {
      var self = this;
      var _dsteste_financeiro;
      var _dynaformteste_financeiro;
      var _personalizedFilter;
      var _navigator;
      //Dynaform Interceptors
      self.onDynaformLoaded = onDynaformLoaded;
      self.customTabsLoader = customTabsLoader;
      self.interceptNavigator = interceptNavigator;
      self.interceptPersonalizedFilter = interceptPersonalizedFilter;
      //Dynaform intercepttors implementation
      ObjectUtils.implements(self, IDynaformInterceptor);
      self.interceptFieldMetadata = interceptFieldMetadata;
      self.interceptDataset = interceptDataset;
      self.interceptDynaform = interceptDynaform;
      self.acceptField = acceptField;
      //{declaration interceptors dynaform placeholder}            
      //Dataset Interceptors
      ObjectUtils.implements(self, IDataSetObserver);
      self.dataSaved = dataSaved;
      self.insertionModeActivated = insertionModeActivated;
      self.currentLineChanged = currentLineChanged;
      self.refreshed = refreshed;
      self.closed = closed;
      self.recordRemoved = recordRemoved;
      self.dataModified = dataModified;
      self.editionCanceled = editionCanceled;
      self.selectionChanged = selectionChanged;
      self.editionModeActivated = editionModeActivated;
      self.saveAvoided = saveAvoided;
      self.allEvents = allEvents;
      self.uploadingFile = uploadingFile;
      self.cleared = cleared;
      //{declaration interceptors dataset placeholder}           
      function onDynaformLoaded(dynaform, dataset) {
         _dynaformteste_financeiro = dynaform;
         _dsteste_financeiro = dataset;
         _dsteste_financeiro.addObserver(self);
      }

      function customTabsLoader(entityName) {
         if (entityName == 'teste_financeiro') {
            var customTabs = [];
            //{customTabs placeholder}
            return customTabs;
         }
      }

      function interceptPersonalizedFilter(personalizedFilter, dataset) {
         _personalizedFilter = personalizedFilter;
      }

      function interceptNavigator(navigator, dynaform) {
         _navigator = navigator;
      }

      function interceptFieldMetadata(fieldMetadata, dataset, dynaform) {}

      function interceptDataset(dynaform, dataset) {}

      function interceptDynaform(dynaform) {}

      function acceptField(fieldMD, dynaform, dataset) {
         return true;
      }
      //{implementation interceptors dynaform placeholder}
      //Dataset interceptors implementation
      function dataSaved(isNew, records) {}

      function insertionModeActivated() {}

      function currentLineChanged(newIndex) {}

      function refreshed() {}

      function closed() {}

      function recordRemoved(record) {}

      function dataModified(fieldName) {}

      function editionCanceled() {}

      function selectionChanged() {}

      function editionModeActivated() {}

      function saveAvoided(nullFieldNames) {}

      function allEvents(event, parameters) {}

      function uploadingFile(uploading) {}

      function cleared() {}
      //{implementation interceptors dataset placeholder}
      //{popup callers placeholder}           
   }
]);
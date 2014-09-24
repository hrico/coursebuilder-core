/**
 * Define the methods of the GCB rich text editor here.
 */
function getGcbRteDefs(env, Dom, Editor, Resize) {
  return {
    setOptions: function(options) {
      GcbRteField.superclass.setOptions.call(this, options);
      this.options.opts = options.opts || {};
      this.options.excludedCustomTags = options.excludedCustomTags || [];
      this.options.supportCustomTags = options.supportCustomTags || false;
    },

    renderComponent: function() {
      // Make a unique id for the field
      if (!GcbRteField.idCounter) {
        GcbRteField.idCounter = 0;
      }
      this.id = "gcbRteField-" + GcbRteField.idCounter;
      GcbRteField.idCounter += 1;

      // Insert the text area for plain text editing
      this.el = document.createElement('textarea');
      this.el.setAttribute('id', this.id);
      if(this.options.name) {
        this.el.setAttribute('name', this.options.name);
      }

      this.fieldContainer.appendChild(this.el);
      this.isInRteMode = false;

      this._replaceTextAreaWithCodeMirror();

      // Make a button to toggle between plain text and rich text
      var showRteText = "Rich Text";
      var hideRteText = "<HTML>";
      var showRteFlag = false;
      var toggle = document.createElement("div");
      var toggleText = document.createTextNode(showRteText);
      toggle.appendChild(toggleText);
      toggle.className = "rte-control inputEx-Button";

      var self = this;
      toggle.onclick = function() {
        showRteFlag = !showRteFlag;
        if (showRteFlag) {
          if (self.editor) {
            self.showExistingRte();
          } else {
            self.showNewRte();
          }
          toggleText.nodeValue = hideRteText;
          self.isInRteMode = true;
        } else {
          self.hideRte();
          toggleText.nodeValue = showRteText;
          self.isInRteMode = false;
        }
      };
      this.divEl.appendChild(toggle);
    },

    _addResize: function() {
      var that = this;
      var editor = this.editor;
      var currentValue;
      this.resize = new Resize(this.editor.get('element_cont').get('element'),
          {
            handles: ['br'],
            minHeight: 300,
            minWidth: 400,
            proxy: true,
            setSize: false
          }
      );
      this.resize.on('startResize', function() {
        currentValue = that.getValue();
        editor.hide();
        editor.set('disabled', true);
      });
      this.resize.on('resize', function(args) {
        that.setValue(currentValue);
        var h = args.height;
        var th = (editor.toolbar.get('element').clientHeight + 2);
        editor.set('width', args.width + 'px');
        editor.set('height', (h - th) + 'px');
        editor.set('disabled', false);
        editor.show();
      });
    },

    _removeResize: function() {
      if (this.resize) {
        this.resize.destroy();
      }
    },

    _replaceTextAreaWithCodeMirror: function() {
      if (! env.can_highlight_code) {
        return;
      }

      this.cmReady = false;

      // note: the first calling when this.cmInstance does not exist
      //       (by renderComponent) will not make CodeMirror ready
      //       this is because setValue must be call after renderComponent
      //       (to sync old value from database, "" will passed for first time)
      //       this is why this.cmReady will be set on the else clause
      if (!this.cmInstance) {
        // div for scrollbar positional-correction
        var cmDiv = document.createElement('div');
        this.fieldContainer.appendChild(cmDiv);
        $(cmDiv).css("overflow", "auto");
        $(cmDiv).css("position", "relative");
        cmDiv.className = 'codemirror-container-editable'
        this.cmInstance = CodeMirror(cmDiv, {
          value: this.el.value,
          lineNumbers: true,
          keyMap: "sublime",
          mode: "htmlmixed"
        });
        this.cmInstance.gcbCodeMirrorMonitor = this;
      } else {
        this.cmInstance.setValue(this.el.value);
        this.cmReady = true;
      }

      var textArea = this.el;
      Dom.setStyle(textArea, 'visibility', 'hidden');
      Dom.setStyle(textArea, 'top', '-9999px');
      Dom.setStyle(textArea, 'left', '-9999px');
      Dom.setStyle(textArea, 'position', 'absolute');
      Dom.addClass(textArea, 'raw-text-editor');

      var cmWrapper = this.cmInstance.getWrapperElement();
      Dom.setStyle(cmWrapper, 'visibility', 'visible');
      Dom.setStyle(cmWrapper, 'top', '');
      Dom.setStyle(cmWrapper, 'left', '');
      Dom.setStyle(cmWrapper, 'position', 'static');

      var self = this;
      window.setTimeout(function(){
        self.cmInstance.refresh();
      }, 0);
    },

    _syncTextAreaWithCodeMirror: function() {
      if (! env.can_highlight_code) {
        return;
      }

      this.el.value = this.cmInstance.getValue();
    },

    _replaceCodeMirrorWithTextArea: function() {
      if (! env.can_highlight_code) {
        return;
      }

      if (this.cmInstance) {
        this._syncTextAreaWithCodeMirror();

        this.cmReady = false;

        var textArea = this.el;
        Dom.setStyle(textArea, 'visibility', 'visible');
        Dom.setStyle(textArea, 'top', '');
        Dom.setStyle(textArea, 'left', '');
        Dom.setStyle(textArea, 'position', 'static');

        var cmWrapper = this.cmInstance.getWrapperElement();
        Dom.setStyle(cmWrapper, 'visibility', 'hidden');
        Dom.setStyle(cmWrapper, 'top', '-9999px');
        Dom.setStyle(cmWrapper, 'left', '-9999px');
        Dom.setStyle(cmWrapper, 'position', 'absolute');
      }
    },

    showNewRte: function() {
      this._replaceCodeMirrorWithTextArea();

      var that = this;
      var options = this.options;
      var _def = {
        autoHeight: true,
        focusAtStart: true,
      };
      // TODO(emichael,jorr): Remove browser sniffing
      if (navigator.userAgent.match(/MSIE/)) {
        _def.autoHeight = false;
        _def.height = '300px';
      }
      // Merge options.opts into the default options
      var opts = options.opts;
      for (var i in opts) {
        if (opts.hasOwnProperty(i)) {
          _def[i] = opts[i];
        }
      }

      var editor = new Editor(this.id, _def);

      // Disable any HTML cleaning done by the editor.
      editor.cleanHTML = function(html) {
        if (!html) {
            html = this.getEditorHTML();
        }
        this.fireEvent('cleanHTML',
            {type: 'cleanHTML', target: this, html: html});
        return html;
      };
      editor._cleanIncomingHTML = function(html) {
        return html;
      };
      editor._fixNodes = function() {};

      editor.on('editorContentLoaded', function() {
        that._addResize();
      });

      // Set up a button to add custom tags
      if (options.supportCustomTags) {
        editor.on('toolbarLoaded', function() {
          var button = {
            type: 'push',
            label: 'Insert Google Course Builder component',
            value: 'insertcustomtag',
            disabled: false
          };
          editor.toolbar.addButtonToGroup(button, 'insertitem');
          editor.toolbar.on('insertcustomtagClick',
              function() {
                // defer dereferencing the _customTagManager, which is
                // created later
                that._customTagManager.addCustomTag();
              },
              that, true);
        });

        // Poll until the editor iframe has loaded and attach custom tag manager
        (function() {
          var ed = document.getElementById(that.id + '_editor');
          if (ed && ed.contentWindow && ed.contentWindow.document &&
              ed.contentWindow.document.readyState == 'complete') {
            that._customTagManager = new CustomTagManager(ed.contentWindow,
                editor, env.custom_rte_tag_icons,
                that.options.excludedCustomTags,
                new FrameProxyOpener(window),
                {
                  getAddUrl: function() {
                    return getAddCustomTagUrl(
                        env, null, that.options.excludedCustomTags);
                  },
                  getEditUrl: function(tagName) {
                    return getEditCustomTagUrl(env, tagName);
                  }
                });
          } else {
            setTimeout(arguments.callee, 100);
          }
        })();
      } else {
        this._customTagManager = new DummyCustomTagManager();
      }

      this.editor = editor;
      this.editor.render();
    },

    showExistingRte: function() {
      this._replaceCodeMirrorWithTextArea();

      var editor = this.editor,
          textArea = this.el;
          rteDiv = textArea.previousSibling;

      if (this._cbGetValue) {
        this.getValue = this._cbGetValue;
      }

      this._addResize();

      Dom.setStyle(rteDiv, 'position', 'static');
      Dom.setStyle(rteDiv, 'top', '0');
      Dom.setStyle(rteDiv, 'left', '0');
      Dom.setStyle(textArea, 'visibility', 'hidden');
      Dom.setStyle(textArea, 'top', '-9999px');
      Dom.setStyle(textArea, 'left', '-9999px');
      Dom.setStyle(textArea, 'position', 'absolute');
      editor.get('element_cont').addClass('yui-editor-container');
      editor._setDesignMode('on');
      editor.setEditorHTML(textArea.value);
      this._customTagManager.insertMarkerTags();
    },

    hideRte: function() {
      var editor = this.editor,
          textArea = this.el;
          rteDiv = textArea.previousSibling;

      this._customTagManager.removeMarkerTags();
      editor.saveHTML();

      this._cbGetValue = this.getValue;
      this.getValue = function() {
        return textArea.value;
      };

      this._removeResize();

      Dom.setStyle(rteDiv, 'position', 'absolute');
      Dom.setStyle(rteDiv, 'top', '-9999px');
      Dom.setStyle(rteDiv, 'left', '-9999px');
      editor.get('element_cont').removeClass('yui-editor-container');
      Dom.setStyle(textArea, 'visibility', 'visible');
      Dom.setStyle(textArea, 'top', '');
      Dom.setStyle(textArea, 'left', '');
      Dom.setStyle(textArea, 'position', 'static');
      Dom.addClass(textArea, 'raw-text-editor');

      this._replaceTextAreaWithCodeMirror();
    },

    setValue: function(value, sendUpdatedEvt) {
      if (this.isInRteMode) {
        this.editor.setEditorHTML(value);
      } else {
        this.el.value = value;
        this._replaceTextAreaWithCodeMirror();
      }
      if(sendUpdatedEvt !== false) {
        this.fireUpdatedEvt();
      }
    },

    getValue: function() {
      if (this.editor) {
        // Clean the editor text before saving, and then restore markers
        this._customTagManager.removeMarkerTags();
        var value = this.editor.saveHTML();
        this._customTagManager.insertMarkerTags();
        return value;
      } else {
        this._syncTextAreaWithCodeMirror();
        return this.el.value;
      }
    }
  };
};

/**
 * A utility class to open the lightbox window.
 *
 * @param win the root window
 */
function FrameProxyOpener(win) {
  this._win = win;
}

FrameProxyOpener.prototype.open = function(url, getValue, context, submit,
    cancel) {
  if (this._win.frameProxy) {
    this._win.frameProxy.close();
  }
  this._win.frameProxy = new FrameProxy('modal-editor', url, getValue, context,
      submit, cancel);
  this._win.frameProxy.open();
};

/**
 * Provides the logic for handling custom tags inside the YUI editor.
 *
 * @param win the window from the RTE iframe
 * @param editor the YUI editor component itself
 * @param customRteTagIcons a list of pairs of tag names and their icon urls
 * @param frameProxyOpener the opener object for the lightbox
 * @param serviceUrlProvider a provider for the urls the lightbox will use
 */
function CustomTagManager(win, editor, customRteTagIcons, excludedCustomTags,
    frameProxyOpener, serviceUrlProvider) {
  this._win = win;
  this._editor = editor;
  this._customRteTagIcons = customRteTagIcons;
  this._excludedCustomTags = excludedCustomTags;
  this._frameProxyOpener = frameProxyOpener;
  this._serviceUrlProvider = serviceUrlProvider;

  this._init();
}

CustomTagManager.prototype = {
  _init: function() {
    var that = this;
    this.insertMarkerTags();

    // Refresh the marker images after a paste
    this._win.document.body.onpaste = function(e) {
      setTimeout(function() {
        that._refreshMarkerTags();
      }, 10);
    };
  },

  /**
   * Returns an instanceid that is unique within the context of the RTE.
   */
  _getNewInstanceId: function(value) {
    var ALPHANUM_CHARS = (
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789');
    var REFID_LENGTH = 12;

    var documentContent = this._win.document.documentElement.innerHTML;
    var foundUniqueInstanceId = false;

    while (true) {
      var newInstanceId = '';
      for (var i = 0; i < REFID_LENGTH; i++) {
        newInstanceId += ALPHANUM_CHARS.charAt(
            Math.floor(Math.random() * ALPHANUM_CHARS.length));
      }

      if(documentContent.indexOf(newInstanceId) == -1) {
        return newInstanceId;
      }
    }
  },

  _setTextContent: function(node, value) {
    if (document.body.textContent) {
      node.textContent = value;
    } else {
      node.innerText = value;
    }
  },

  _populateTagNode: function(node, properties, value) {
    for (var name in properties) {
      if (properties.hasOwnProperty(name)) {
        if (properties[name].type === "text") {
          this._setTextContent(node, value[name]);
        } else {
          node.setAttribute(name, value[name]);
        }
      }
    }
  },

  _getValueFromTagNode: function(properties, node) {
    var value = {};
    for (var name in properties) {
      if (properties.hasOwnProperty(name)) {
        if (properties[name].type === "text") {
          value[name] = node.textContent || node.innerText;
        }
      }
    }

    for (var i = 0; i < node.attributes.length; i++) {
      var name = node.attributes[i].name;
      value[name] = node.attributes[i].value;
    }

    return value;
  },

  addCustomTag: function() {
    var that = this;
    this._insertInsertionPointTag();
    this._frameProxyOpener.open(
      this._serviceUrlProvider.getAddUrl(),
      null,
      {excludedCustomTags: this._excludedCustomTags}, // context object
      function(value, schema) { // on submit
        that._insertCustomTag(value, schema);
      },
      function () { // on cancel
        that._removeInsertionPointTag();
      }
    );
  },

  _insertCustomTag: function(value, schema) {
    var node = this._win.document.createElement(value.type.tag);
    this._populateTagNode(
        node, schema.properties.attributes.properties, value.attributes);
    node.setAttribute('instanceid', this._getNewInstanceId());

    var insertionPoint = this._win.document.querySelector('.gcbInsertionPoint');
    insertionPoint.parentNode.replaceChild(node, insertionPoint);

    this._refreshMarkerTags();
  },

  /**
   * When a custom tag is double-clicked, open up a sub-editor in a lightbox.
   */
  _editCustomTag: function(node) {
    var that = this;

    this._frameProxyOpener.open(
      this._serviceUrlProvider.getEditUrl(node.tagName.toLowerCase()),
      function(schema) { // callback for tag values
        return that._getValueFromTagNode(schema.properties, node);
      },
      {excludedCustomTags: this._excludedCustomTags}, // context object
      function(value, schema) { // on submit
        var instanceid = node.getAttribute('instanceid');
        that._populateTagNode(node, schema.properties, value);
        node.setAttribute('instanceid', instanceid);
      },
      function () { /* on cancel */ }
    );
  },

  _refreshMarkerTags: function() {
    this.removeMarkerTags();
    this.insertMarkerTags();
  },

  insertMarkerTags: function() {
    var editorDoc = this._win.document;
    var that = this;
    for (var k = 0; k < this._customRteTagIcons.length; k++) {
      var tag = this._customRteTagIcons[k];
      var elts = editorDoc.getElementsByTagName(tag.name);
      for (var i = elts.length - 1; i >= 0; i--) {
        var elt = elts[i];
        var img = editorDoc.createElement('img');
        img.src = tag.iconUrl;
        img.className = 'gcbMarker';
        img.style.cursor = 'pointer';
        img.ondblclick = (function(_elt) {
          // Create a new scope with its own pointer to the current element
          return function(event) {
            var event = event || editorWin.event;
            if (event.stopPropagation) {
              event.stopPropagation();
            } else { // IE 8 & 9
              event.cancelBubble = true;
            }
            that._editCustomTag(_elt);
          };
        })(elt);
        img.onmousedown = img.onmouseup = img.onclick = function(event) {
          that._sinkEvent(event);
        };
        img.gcbTag = elt;
        that._styleMarkerTag(img);
        elt.parentNode.replaceChild(img, elt);
      }
    }
  },

  _styleMarkerTag: function(img) {
    img.style.borderRadius = '5px';
    img.style.borderColor = '#ccc';
    img.style.borderWidth = '3px';
    img.style.borderStyle = 'ridge';
    img.style.width = '48px';
    img.style.height = '48px';
  },

  _sinkEvent: function(event) {
    var event = event || this._win.event;
    if (event.preventDefault && event.stopPropagation) {
      event.preventDefault();
      event.stopPropagation();
    } else { // IE 8 & 9
      event.returnValue = false;
      event.cancelBubble = true;
    }
    return false;
  },

  removeMarkerTags: function() {
    var elts = this._win.document.querySelectorAll('.gcbMarker');
    for (var i = 0; i < elts.length; i++) {
      var img = elts[i];
      if (img.gcbTag) {
        img.parentNode.replaceChild(img.gcbTag, img);
      } else {
        img.parentNode.removeChild(img);
      }
    }
  },

  _insertInsertionPointTag: function() {
    this._editor.execCommand('inserthtml',
        '<span class="gcbInsertionPoint"></span>');
  },

  _removeInsertionPointTag: function() {
    this._removeTagsByClass('gcbInsertionPoint');
  },

  _removeTagsByClass: function(clazz) {
    var elts = this._win.document.querySelectorAll('.' + clazz);
    for (var i = 0; i < elts.length; i++) {
      var e = elts[i];
      e.parentNode.removeChild(e);
    }
  }
};

/**
 * A dummy tag manager used when the RTE is in a context where custom tags are
 * not supported.
 */
function DummyCustomTagManager() {};

DummyCustomTagManager.prototype = {
  addCustomTag: function() {},
  insertMarkerTags: function() {},
  removeMarkerTags: function() {}
};

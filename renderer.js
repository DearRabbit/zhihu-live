// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const ipcRenderer = require('electron').ipcRenderer;
const shell = require('electron').shell;

Vue.component('message-attach', {
    template: '<div class="TextAttachment-text" v-if="showText">{{message.text}}</div>\
               <div class="ImageAttachment" v-else-if="showImg">\
               <div class="FixedSizeImage-container" @click="externalImagePage" :style="fixedSize">\
               <img :srcset="message.image.url" class="FixedSizeImage-image" :width="message.image.width"></div></div>\
               <div class="AudioAttachment" v-else-if="showAudio"><video controls="" name="media" class="AudioPlayer" preload="none"><source :src="message.audio.url" type="audio/aac"></video></div>\
               <div class="TextAttachment-text" v-else>[[不支持的类型, 请联系我]]</div>',
    props: ['message'],
    data: function () {
        return {
            'showText': this.message.type == 'text',
            'showImg': this.message.type == 'image',
            'showAudio': this.message.type == 'audio'
        }
    },
    computed: {
        fixedSize: function () {
            return 'width: 293px; height: '+this.message.image.height/this.message.image.width*293+'px;';
        }
    },
    methods: {
        externalImagePage: function () {
            shell.openExternal(this.message.image.full.url);
        }
    }
});
const mainBody = new Vue({
    el: '#mainBody',
    data: {
        showNav: true,
        showHomePage: true,
        searchQueryInNav: '',
        selectedID: -1,

        formLabelWidth: '120px',
        showImportZhihu: false,
        zhihuForm: {userid: '', z_c0: ''},
        zhihuListLoading: false,
        zhihuDataLoading: false,
        showImportButton: false,

        livePage: null,

        importListData: [],

        multipleSelection: [],
        listData: []
    },
    computed: {
        filteredInNav: function () {
            return this._filter(this.searchQueryInNav);
        },
        debugMsg: function () {
            return this.livePage.message.slice(0, 30);
        }
    },
    methods: {
        forfun: function () {
            var self = this;
            this.$alert('确定格式化硬盘吗?', '不要随便乱按', {
                callback: function () {
                    setTimeout(function () {
                        self.$message.success('格式化硬盘成功');
                    }, 10000);
                }
            });
        },
        calcDate: function (utcsec) {
            return (new Date(utcsec*1000)).toLocaleString();
        },
        externalLivePage: function (id) {
            shell.openExternal('https://www.zhihu.com/lives/' + id);
        },
        externalUserPage: function (id) {
            shell.openExternal('https://www.zhihu.com/people/' + id);
        },
        _filter: function (query) {
            var localQuery = query && query.toLowerCase();
            if (localQuery) {
                return this.listData.filter(function(obj) {
                    return obj.subject.toLowerCase().indexOf(localQuery) !== -1;
                });
            }
            return this.listData;
        },
        _loadList: function() {
            ipcRenderer.send('loadList');
        },
        openID: function (id) {
            ipcRenderer.send('getLiveDetail', id);
            this.selectedID = id;
        },
        openHome: function () {
            this.selectedID = -1;
            this.showHomePage = true;
        },
        handleSelectionChange: function (val){
            this.multipleSelection = val.map((x) => x.id);
        },
        cleanForm: function () {
            this.zhihuForm.userid = '';
            this.zhihuForm.z_c0 = '';
            this.importListData = [];
            this.showImportButton = false;
        },
        importZhihuList: function () {
            this.zhihuListLoading = true;

            ipcRenderer.send('getZhihuLivesList', {
                userid: this.zhihuForm.userid,
                z_c0: this.zhihuForm.z_c0
            });
        },
        importZhihuListDone: function (err) {
            this.zhihuListLoading = false;

            if (err) {
                this.$message.error('错误发生了?');
            }
            else {
                this.showImportButton = true;
            }
        },
        importZhihuData: function () {
            this.zhihuDataLoading = true;
            ipcRenderer.send('getZhihuLivesData', {
                list: this.importListData,
                z_c0: this.zhihuForm.z_c0
            });
        },
        importZhihuDataDone: function (err) {
            this.zhihuDataLoading = false;
            if (err) {
                this.$message.error('错误发生了?');
            }
            else {
                ipcRenderer.send('loadList');
                this.$message.success('导入完了');
            }
        },
        importDbList: function () {
            ipcRenderer.send('importDatabase');
        },
        deleteConfirm: function () {
            if (this.multipleSelection.length > 0) {
                this.$alert('这将从数据库中移除对应主题（其实删也没有什么用，算了吧。）', '确认删除吗?', {
                    confirmButtonText: '确定',
                    callback: action => this.deleteData()
                });
            }
        },
        deleteData: function() {
            var self = this;
            self.listData = self.listData.filter(function (obj) {
                return self.multipleSelection.indexOf(obj.id) === -1;
            });
            // send some delete data to main
            ipcRenderer.send('deleteData', self.multipleSelection);
            self.multipleSelection = [];
        },
    }
});

(function() {
    ipcRenderer.on('getLiveDetail-reply', function(event, arg) {
        mainBody.livePage = arg;
        mainBody.showHomePage = false;
    });
    ipcRenderer.on('getLiveDetail-error', function(event, arg) {
        mainBody.$message.error('错误发生了?');
    });
    ipcRenderer.on('importDatabase-reply', function(event, arg) {
        mainBody.$message.success('导入完了');
        ipcRenderer.send('loadList');
    });
    ipcRenderer.on('importDatabase-error', function(event, arg) {
        mainBody.$message.error('错误发生了?');
    });
    ipcRenderer.on('loadList-reply', function(event, arg) {
        mainBody.listData = arg;
    });
    ipcRenderer.on('loadList-error', function(event, arg) {
        mainBody.$message.error('错误发生了?');
    });
    ipcRenderer.on('getZhihuLivesList-reply', function(event, arg) {
        mainBody.importListData = arg;
        mainBody.importZhihuListDone();
    });
    ipcRenderer.on('getZhihuLivesList-error', function(event, arg) {
        mainBody.importZhihuListDone(arg);
    });
    ipcRenderer.on('getZhihuLivesData-reply', function(event, arg) {
        mainBody.importZhihuDataDone();
    });
    ipcRenderer.on('getZhihuLivesData-error', function(event, arg) {
        mainBody.importZhihuDataDone(arg);
    });
    ipcRenderer.send('loadList');
})();

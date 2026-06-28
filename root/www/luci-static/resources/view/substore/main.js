'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

var callServiceRestart = rpc.declare({
	object: 'service',
	method: 'restart',
	params: ['name']
});

function getServiceStatus() {
	return callServiceList('substore').then(function(res) {
		try {
			return res['substore']['instances']['instance1']['running'];
		} catch(e) {
			return false;
		}
	});
}

function downloadFile(url, dest) {
	return L.resolveDefault(rpc.call('luci', 'exec', {
		command: 'wget',
		params: ['-q', '-O', dest, url]
	}), null);
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('substore'),
			getServiceStatus()
		]);
	},

	render: function(data) {
		var isRunning = data[1];
		var m, s, o;

		m = new form.Map('substore', _('Sub-Store'),
			_('Advanced Subscription Manager. Backend and frontend are bundled in this package.'));

		// ── 状态栏 ──────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('Service Status'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status', _('Running Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			var color = isRunning ? '#2ecc71' : '#e74c3c';
			var text  = isRunning ? _('Running') : _('Stopped');
			return '<span style="color:%s;font-weight:bold;">● %s</span>'.format(color, text);
		};

		o = s.option(form.DummyValue, '_open', _('Web Panel'));
		o.rawhtml = true;
		o.cfgvalue = function(section_id) {
			var port = uci.get('substore', section_id, 'frontend_port') || '3001';
			var path = uci.get('substore', section_id, 'frontend_backend_path') || '/sub-store-api';
			var host = window.location.hostname;
			var url  = 'http://' + host + ':' + port + '?api=http://' + host + ':' + port + path;
			if (!isRunning) {
				return '<span style="color:#999;">— ' + _('Start service first') + ' —</span>';
			}
			return '<a href="%s" target="_blank" class="btn cbi-button cbi-button-action">%s ↗</a>'
				.format(url, _('Open Sub-Store'));
		};

		o = s.option(form.DummyValue, '_actions', _('Actions'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<button class="btn cbi-button cbi-button-apply" id="btn_restart">%s</button>'
				.format(_('Restart'));
		};
		o.write = function() {};

		o = s.option(form.DummyValue, '_update', _('Update'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<button class="btn cbi-button cbi-button-action" id="btn_update_backend">%s</button> \
				<button class="btn cbi-button cbi-button-action" id="btn_update_frontend">%s</button> \
				<span id="update_status" style="margin-left:8px;font-size:13px;"></span>'
				.format(_('Update Backend'), _('Update Frontend'));
		};
		o.write = function() {};

		o = s.option(form.DummyValue, '_log', _('Service Log'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<div style="margin-top:4px">\
				<button class="btn cbi-button" id="btn_log">%s</button>\
				<pre id="substore_log" style="display:none;margin-top:8px;padding:8px;background:#1a1a1a;color:#eee;font-size:12px;max-height:300px;overflow-y:auto;border-radius:4px;white-space:pre-wrap;word-break:break-all;"></pre>\
			</div>'.format(_('View Log'));
		};
		o.write = function() {};

		// ── 基础设置 ────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('Basic Settings'));
		s.anonymous = true;
		s.addremove = false;

		o = s.option(form.Flag, 'enabled', _('Enable'), _('Start Sub-Store on boot and apply settings on save'));
		o.rmempty = false;

		o = s.option(form.Value, 'data_dir', _('Data Directory'));
		o.default = '/etc/sub-store';
		o.placeholder = '/etc/sub-store';

		o = s.option(form.Value, 'backend_custom_name', _('Instance Name'), _('Shown in the frontend UI'));
		o.default = 'OpenWrt';

		// ── 端口 / 网络 ─────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('Port & Network'));
		s.anonymous = true;

		o = s.option(form.Value, 'frontend_port', _('Service Port'), _('Port for both frontend and backend'));
		o.default = '3001';
		o.datatype = 'port';

		o = s.option(form.Value, 'frontend_host', _('Listen Address'));
		o.default = '0.0.0.0';
		o.placeholder = '0.0.0.0';

		o = s.option(form.Value, 'frontend_backend_path', _('Backend URL Prefix'), _('Used as API path. Avoid special characters'));
		o.default = '/sub-store-api';
		o.placeholder = '/sub-store-api';

		o = s.option(form.Value, 'http_meta_port', _('HTTP-META Port'),
			_('Port for HTTP-META engine. Avoid conflict with other services'));
		o.default = '9876';
		o.datatype = 'port';

		// ── 同步 / 定时任务 ─────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('Sync & Cron Jobs'));
		s.anonymous = true;

		o = s.option(form.Value, 'backend_sync_cron', _('Subscription Sync Cron'),
			_('Cron expression to push subscriptions to Gist. e.g. 55 23 * * *'));
		o.placeholder = '55 23 * * *';

		o = s.option(form.Value, 'backend_upload_cron', _('Backup Upload Cron'),
			_('Scheduled backup of all Sub-Store data to Gist'));
		o.placeholder = '0 2 * * *';

		o = s.option(form.Value, 'backend_download_cron', _('Backup Download Cron'),
			_('Scheduled restore of Sub-Store data from Gist'));
		o.placeholder = '';

		o = s.option(form.Value, 'produce_cron', _('Subscription Pre-process Cron'),
			_('Format: cron,type,name;cron,type,name  e.g. 0 */2 * * *,sub,mySubName'));
		o.placeholder = '0 */2 * * *,sub,mySubName';

		// ── 推送通知 ────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('Push Notifications'));
		s.anonymous = true;

		o = s.option(form.Value, 'push_service', _('Push Service URL'),
			_('Supports Bark, Telegram, PushPlus, etc. Use [推送标题] and [推送内容] as placeholders'));
		o.placeholder = 'https://api.day.app/YOUR_KEY/[推送标题]/[推送内容]';

		// ── 高级设置 ────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('Advanced'));
		s.anonymous = true;

		o = s.option(form.Value, 'cors_allowed_origins', _('CORS Allowed Origins'),
			_('Comma-separated list of allowed browser origins. Use * to allow all'));
		o.default = '*';
		o.placeholder = '*';

		o = s.option(form.Value, 'backend_default_proxy', _('Default Proxy'),
			_('Used for fetching subscriptions. Supports socks5://, http://, https://'));
		o.placeholder = 'http://127.0.0.1:7890';

		o = s.option(form.Value, 'max_header_size', _('Max Header Size (bytes)'),
			_('Increase if you get "Headers Overflow Error"'));
		o.default = '32768';
		o.datatype = 'uinteger';

		o = s.option(form.Value, 'body_json_limit', _('JSON Body Limit'),
			_('e.g. 1mb, 10mb'));
		o.default = '1mb';
		o.placeholder = '1mb';

		o = s.option(form.Value, 'backend_custom_icon', _('Custom Icon URL'),
			_('Custom icon shown in the frontend for this backend'));
		o.placeholder = 'https://example.com/icon.png';

		// ── 数据恢复 ────────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('Data Bootstrap'));
		s.anonymous = true;

		o = s.option(form.Value, 'data_url', _('Remote Data URL'),
			_('On every start, fetch and restore data from this URL (raw Gist link, etc.)'));
		o.placeholder = 'https://gist.githubusercontent.com/user/id/raw/Sub-Store#noCache';

		o = s.option(form.Value, 'data_url_post', _('Post-fetch Command'),
			_('JS expression to modify loaded data, e.g. content.settings.gistToken=\'xxx\''));
		o.placeholder = "content.settings.gistToken='your_token_here'";

		// ── GeoIP / MMDB ────────────────────────────────────────
		s = m.section(form.NamedSection, 'config', 'substore', _('GeoIP / MMDB'));
		s.anonymous = true;

		o = s.option(form.Value, 'mmdb_country_path', _('GeoLite2-Country Path'));
		o.placeholder = '/etc/sub-store/GeoLite2-Country.mmdb';

		o = s.option(form.Value, 'mmdb_asn_path', _('GeoLite2-ASN Path'));
		o.placeholder = '/etc/sub-store/GeoLite2-ASN.mmdb';

		o = s.option(form.Value, 'mmdb_cron', _('MMDB Update Cron'));
		o.placeholder = '0 4 * * 1';

		return m.render().then(function(node) {

			// 重启按钮
			var btnRestart = node.querySelector('#btn_restart');
			if (btnRestart) {
				btnRestart.addEventListener('click', function() {
					btnRestart.disabled = true;
					btnRestart.textContent = _('Restarting...');
					L.resolveDefault(rpc.call('luci', 'setInitAction', {
						name: 'substore',
						action: 'restart'
					}), null).then(function() {
						ui.addNotification(null, E('p', _('Sub-Store restarted.')), 'info');
					}).finally(function() {
						btnRestart.disabled = false;
						btnRestart.textContent = _('Restart');
					});
				});
			}

			// 更新后端按钮
			var btnUpdateBackend = node.querySelector('#btn_update_backend');
			var updateStatus = node.querySelector('#update_status');
			if (btnUpdateBackend) {
				btnUpdateBackend.addEventListener('click', function() {
					btnUpdateBackend.disabled = true;
					updateStatus.textContent = _('Downloading backend...');
					fetch('/cgi-bin/luci/rpc/sys', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							method: 'exec',
							params: ['wget -q -O /usr/libexec/substore/sub-store.bundle.js https://github.com/sub-store-org/Sub-Store/releases/latest/download/sub-store.bundle.js && echo OK || echo FAIL']
						})
					}).then(function(r) { return r.json(); }).then(function(res) {
						if ((res.result || '').indexOf('OK') !== -1) {
							updateStatus.textContent = _('Backend updated! Restarting...');
							return L.resolveDefault(rpc.call('luci', 'setInitAction', {
								name: 'substore', action: 'restart'
							}), null).then(function() {
								updateStatus.textContent = _('Backend updated and restarted.');
							});
						} else {
							updateStatus.textContent = _('Backend update failed.');
						}
					}).catch(function() {
						updateStatus.textContent = _('Backend update failed.');
					}).finally(function() {
						btnUpdateBackend.disabled = false;
					});
				});
			}

			// 更新前端按钮
			var btnUpdateFrontend = node.querySelector('#btn_update_frontend');
			if (btnUpdateFrontend) {
				btnUpdateFrontend.addEventListener('click', function() {
					btnUpdateFrontend.disabled = true;
					updateStatus.textContent = _('Downloading frontend...');
					fetch('/cgi-bin/luci/rpc/sys', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							method: 'exec',
							params: ['wget -q -O /tmp/dist.zip https://github.com/sub-store-org/Sub-Store-Front-End/releases/latest/download/dist.zip && rm -rf /www/sub-store/dist && unzip -q /tmp/dist.zip -d /www/sub-store && rm -f /tmp/dist.zip && echo OK || echo FAIL']
						})
					}).then(function(r) { return r.json(); }).then(function(res) {
						if ((res.result || '').indexOf('OK') !== -1) {
							updateStatus.textContent = _('Frontend updated successfully.');
						} else {
							updateStatus.textContent = _('Frontend update failed.');
						}
					}).catch(function() {
						updateStatus.textContent = _('Frontend update failed.');
					}).finally(function() {
						btnUpdateFrontend.disabled = false;
					});
				});
			}

			// 日志按钮
			var btnLog = node.querySelector('#btn_log');
			var logBox = node.querySelector('#substore_log');
			if (btnLog && logBox) {
				btnLog.addEventListener('click', function() {
					if (logBox.style.display === 'none') {
						fetch('/cgi-bin/luci/rpc/sys', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								method: 'exec',
								params: ['logread 2>/dev/null | grep -i "sub-store\\|substore" | tail -100']
							})
						}).then(function(r) { return r.json(); }).then(function(res) {
							logBox.textContent = (res.result || '').trim() || _('No logs found.');
							logBox.style.display = 'block';
							btnLog.textContent = _('Hide Log');
						}).catch(function() {
							logBox.textContent = _('Failed to load log.');
							logBox.style.display = 'block';
							btnLog.textContent = _('Hide Log');
						});
					} else {
						logBox.style.display = 'none';
						btnLog.textContent = _('View Log');
					}
				});
			}

			return node;
		});
	},

	handleSaveApply: function(ev) {
		return this.handleSave(ev).then(function() {
			return L.resolveDefault(rpc.call('luci', 'setInitAction', {
				name: 'substore',
				action: 'restart'
			}), null);
		});
	}
});

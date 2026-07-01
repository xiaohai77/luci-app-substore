'use strict';
'require view';
'require form';
'require uci';

// 校验监听地址：:: 、0.0.0.0、合法IPv4、合法IPv6
function validateHost(value) {
	if (!value || value.trim() === '') return true;
	var v = value.trim();

	// :: 和 0.0.0.0 是最常用的两个，直接放行
	if (v === '::' || v === '0.0.0.0' || v === '127.0.0.1') return true;

	// 校验IPv4：四段数字，每段0-255
	var ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
	var m4 = v.match(ipv4);
	if (m4) {
		for (var i = 1; i <= 4; i++) {
			if (parseInt(m4[i], 10) > 255) {
				return _('IPv4 地址每段范围为 0-255，请检查输入');
			}
		}
		return true;
	}

	// 校验IPv6：包含冒号的地址（简单判断，不穷举所有格式）
	if (v.indexOf(':') !== -1 && /^[0-9a-fA-F:]+$/.test(v)) return true;

	return _('请输入有效的监听地址，例如 ::、0.0.0.0 或具体 IP 地址');
}

// 校验代理地址：必须以支持的协议开头，且后面有实际内容
function validateProxy(value) {
	if (!value || value.trim() === '') return true;
	var v = value.trim();
	if (/^(http|https|socks5):\/\/.+/.test(v)) return true;
	return _('代理地址必须以 http://、https:// 或 socks5:// 开头');
}

return view.extend({
	load: function() {
		return uci.load('substore');
	},

	render: function() {
		var m, s, o;

		m = new form.Map('substore', _('Sub-Store'), null);

		s = m.section(form.NamedSection, 'config', 'substore', _('端口与网络'));
		s.anonymous = true;

		o = s.option(form.Value, 'frontend_port', _('服务端口'), _('前端和后端统一使用此端口'));
		o.default = '3001';
		o.datatype = 'port';

		o = s.option(form.Value, 'frontend_host', _('监听地址'), _(':: 表示同时监听 IPv4 和 IPv6，0.0.0.0 仅监听 IPv4'));
		o.default = '::';
		o.placeholder = '::';
		o.validate = function(section_id, value) {
			return validateHost(value);
		};

		o = s.option(form.Value, 'backend_default_proxy', _('默认代理'), _('抓取订阅时使用的代理，支持 socks5://、http://、https://'));
		o.placeholder = 'http://127.0.0.1:7890';
		o.validate = function(section_id, value) {
			return validateProxy(value);
		};

		return m.render();
	}
});

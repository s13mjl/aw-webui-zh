import moment from 'moment';
import { seconds_to_duration } from './time';
import DOMPurify from 'dompurify';
import _ from 'lodash';
import { i18n } from '~/i18n';

const sanitize = DOMPurify.sanitize;

export function buildTooltip(bucket, e) {
  // WARNING: XSS risk, make sure to sanitize properly
  // FIXME: Not actually tested against XSS attacks, implementation needs to be verified in tests.
  let inner = i18n.t('tooltip.unknownBucket');

  // if same day, don't show date
  let start = moment(e.timestamp);
  let stop = moment(e.timestamp).add(e.duration, 'seconds');
  if (start.isSame(stop, 'day')) {
    start = start.format('HH:mm:ss');
    stop = stop.format('HH:mm:ss');
  } else {
    start = start.format('YYYY-MM-DD HH:mm:ss');
    stop = stop.format('YYYY-MM-DD HH:mm:ss');
  }

  if (bucket.type == 'currentwindow') {
    inner = `
      <tr><th>${i18n.t('tooltip.app')}</th><td>${sanitize(e.data.app)}</td></tr>
      <tr><th>${i18n.t('tooltip.title')}</th><td>${sanitize(e.data.title)}</td></tr>
      `;
  } else if (bucket.type == 'web.tab.current') {
    inner = `
      <tr><th>${i18n.t('tooltip.title')}</th><td>${sanitize(e.data.title)}</td></tr>
      <tr><th>${i18n.t('tooltip.url')}</th><td><a href=${sanitize(e.data.url)}>${sanitize(
      e.data.url
    )}</a></td></tr>
      `;
  } else if (bucket.type.startsWith('app.editor')) {
    inner = `
      <tr><th>${i18n.t('tooltip.filename')}</th><td>${sanitize(
      _.last(e.data.file.split('/'))
    )}</td></tr>
      <tr><th>${i18n.t('tooltip.path')}</th><td>${sanitize(e.data.file)}</td></tr>
      <tr><th>${i18n.t('tooltip.language')}</th><td>${sanitize(e.data.language)}</td></tr>
      `;
  } else if (bucket.type.startsWith('general.stopwatch')) {
    inner = `
      <tr><th>${i18n.t('tooltip.label')}</th><td>${sanitize(e.data.label)}</td></tr>
      `;
  } else {
    inner = `
      <tr><th>${i18n.t('tooltip.data')}</th><td>${sanitize(JSON.stringify(e.data))}</td></tr>
      `;
  }
  return `<table>
    <tr></tr>
    <tr><th>${i18n.t('tooltip.start')}</th><td>${start}</td></tr>
    <tr><th>${i18n.t('tooltip.stop')}</th><td>${stop}</td></tr>
    <tr><th>${i18n.t('tooltip.duration')}&nbsp;</th><td>${seconds_to_duration(e.duration)}</td></tr>
    ${inner}
    </table>`;
}

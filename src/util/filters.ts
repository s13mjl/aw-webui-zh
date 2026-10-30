'use strict';

import _ from 'lodash';
import { seconds_to_duration, friendlydate } from './time';
import { periodReadable } from './timeperiod';
import moment from 'moment';

export function iso8601(timestamp: string | number | Date): string {
  return moment.parseZone(timestamp).format();
}

export function shortdate(timestamp: string | number | Date): string {
  return moment(timestamp).format('YYYY-MM-DD');
}

export function shorttime(timestamp: string | number | Date): string {
  return moment(timestamp).format('HH:mm');
}

export function friendlytime(timestamp: string | number | Date): string {
  return friendlydate(timestamp);
}

export function friendlyduration(seconds: number): string {
  return seconds_to_duration(seconds);
}

export function friendlyperiod(timeperiod: any): string {
  return periodReadable(timeperiod);
}

export const filters = {
  iso8601,
  shortdate,
  shorttime,
  friendlytime,
  friendlyduration,
  friendlyperiod,
  orderBy: _.orderBy,
};

export default filters;

// Unit tests assert upstream English copy. Pin the singleton locale so
// results don't depend on the host (Node 21+ exposes navigator.language).
import { i18n } from '~/i18n';

i18n.locale = 'en';

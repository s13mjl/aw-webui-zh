<template lang="pug">
div
  b-form-group(:label="$t('queryOptions.hostname')" label-cols=2)
    b-form-select(v-model="queryOptionsData.hostname")
      option(v-for="hostname in hostnameChoices")
        | {{hostname}}
  b-form-group(:label="$t('queryOptions.start')" label-cols=2)
    b-form-datepicker(v-model="queryOptionsData.start")
  b-form-group(:label="$t('queryOptions.stop')" label-cols=2)
    b-form-datepicker(v-model="queryOptionsData.stop")
  b-form-group(:label="$t('queryOptions.toggles')" label-cols=2)
    b-form-checkbox(type="checkbox" v-model="queryOptionsData.filter_afk" :label="$t('queryOptions.filterAfk')" description="")
      label {{ $t('queryOptions.filterAfkHelp') }}
</template>

<script lang="ts">
import Vue from 'vue';
import moment from 'moment';
import { useBucketsStore } from '~/stores/buckets';
import { preferKnownHostnames } from '~/util/hostnames';

export default Vue.extend({
  name: 'QueryOptions',
  props: {
    queryOptions: {
      type: Object,
    },
  },
  data() {
    return {
      bucketsStore: useBucketsStore(),

      queryOptionsData: {
        hostname: '',
        start: moment().subtract(1, 'day').format('YYYY-MM-DD'),
        stop: moment().add(1, 'day').format('YYYY-MM-DD'),
        filter_afk: true,
      },
    };
  },

  computed: {
    hostnameChoices() {
      return preferKnownHostnames(this.bucketsStore.hosts);
    },
  },

  watch: {
    queryOptionsData: {
      handler(value) {
        this.$emit('input', value);
      },
      deep: true,
    },
  },

  async mounted() {
    await this.bucketsStore.ensureLoaded();
    this.queryOptionsData = {
      ...this.queryOptionsData,
      hostname: this.hostnameChoices[0],
      ...this.queryOptions,
    };
    this.$emit('input', this.queryOptionsData);
  },
});
</script>

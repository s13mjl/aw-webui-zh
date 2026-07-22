<template lang="pug">
  div
    b-alert(v-if="isPollVisible", variant="info", show)
      button(type="button", class="close", @click="isPollVisible=false") &times;
      form
        p
          | {{ $t('poll.question') }}
        div(class="radio-options")
          div(v-for="i in options", class="option-group")
            input(type="radio", :id="'option' + i", name="rating", :value="i", v-model="rating")
            br
            label(:for="'option' + i", style="display: block")
              | {{ i }}
      div(style="display: flex; justify-content: space-between")
        a(@click="dontShowAgain" href="#")
          | {{ $t('poll.dontShow') }}
        input(type="submit" :value="$t('poll.submit')" @click="submit")

    b-alert(v-if="isPosFollowUpVisible", variant="info" show)
      button(type="button", class="close", @click="isPosFollowUpVisible=false") &times;
      p
        | {{ $t('poll.positiveThanks') }}
      p
        | {{ $t('poll.positiveReview') }}
      p
        a(href="https://alternativeto.net/software/activitywatch/about/" target="_blank")
          | {{ $t('poll.positiveReviewBtn') }}
      p
        | {{ $t('poll.positiveForum') }}

    b-alert(v-if="isNegFollowUpVisible", variant="info" show)
      button(type="button", class="close", @click="isNegFollowUpVisible=false") &times;
      p
        | {{ $t('poll.negativeSorry') }}
      p
        | {{ $t('poll.negativeAsk') }}
      p
        a(href="https://forum.activitywatch.net/" target="_blank")
          | {{ $t('poll.negativeForumBtn') }}
      p
        a(href="https://github.com/ActivityWatch/activitywatch/issues" target="_blank")
          | {{ $t('poll.negativeGithubBtn') }}
</template>

<style scoped>
.radio-options {
  display: flex;
  justify-content: space-around;
}

.option-group {
  text-align: center;
}

ul {
  margin: 0;
}
</style>

<script lang="ts">
import { range } from 'lodash/fp';
import moment from 'moment';

import { useSettingsStore } from '~/stores/settings';

const NUM_OPTIONS = 10;
// BACKOFF_PERIOD is how many seconds to wait to show the poll again if the user closed it
const BACKOFF_PERIOD = 7 * 24 * 60 * 60;
// The following may be used for testing
// const INITIAL_WAIT_PERIOD = 1;
// const BACKOFF_PERIOD = 1;

export default {
  name: 'user-satisfaction-poll',
  data() {
    return {
      isPollVisible: false,
      isPosFollowUpVisible: false,
      isNegFollowUpVisible: false,
      // options is an array of [1, ..., NUM_OPTIONS]
      options: range(1, NUM_OPTIONS + 1),
      rating: null,
    };
  },
  computed: {
    data: {
      get() {
        const settingsStore = useSettingsStore();
        return settingsStore.userSatisfactionPollData;
      },
      set(value) {
        const settingsStore = useSettingsStore();
        const data = settingsStore.userSatisfactionPollData;
        settingsStore.update({
          userSatisfactionPollData: { ...data, ...value },
        });
      },
    },
  },
  async mounted() {
    if (!this.data.isEnabled) {
      return;
    }

    // Show poll if enough time has passed
    if (moment() >= moment(this.data.nextPollTime)) {
      this.data.timesPollIsShown = this.data.timesPollIsShown + 1;
      this.isPollVisible = true;
      this.data.nextPollTime = moment().add(BACKOFF_PERIOD, 'seconds');
    }

    // Show the poll a maximum of 3 times
    if (this.data.timesPollIsShown > 2) {
      this.data.isEnabled = false;
    }
  },
  methods: {
    submit() {
      this.isPollVisible = false;
      this.data = { ...this.data, isEnabled: false };

      if (parseInt(this.rating) >= 6) {
        this.isPosFollowUpVisible = true;
      } else {
        this.isNegFollowUpVisible = true;
      }
    },
    dontShowAgain() {
      this.isPollVisible = false;
      this.data = { ...this.data, isEnabled: false };
    },
  },
};
</script>

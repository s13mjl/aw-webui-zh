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
import { mapState } from 'pinia';

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
      isSaving: false,
      // options is an array of [1, ..., NUM_OPTIONS]
      options: range(1, NUM_OPTIONS + 1),
      rating: null,
    };
  },
  computed: {
    ...mapState(useSettingsStore, { data: 'userSatisfactionPollData' }),
  },
  async mounted() {
    const settings = useSettingsStore();
    try {
      await settings.ensureLoaded();
    } catch (err) {
      console.error('无法加载满意度调查设置：', err);
      return;
    }
    // 首次加载时持久化初始截止时间，避免每次打开页面都顺延。
    if (!settings._storedKeys.includes('userSatisfactionPollData')) {
      if (!(await this.saveData({ ...this.data }))) return;
    }
    if (!this.data.isEnabled) {
      return;
    }

    // 最多展示 3 次，达到上限后关闭并持久化，不再展示。
    if (this.data.timesPollIsShown >= 3) {
      await this.saveData({ ...this.data, isEnabled: false });
      return;
    }

    // 时间到达后展示，并持久化展示次数与退避时间。
    if (moment() >= moment(this.data.nextPollTime)) {
      const timesPollIsShown = this.data.timesPollIsShown + 1;
      if (
        await this.saveData({
          ...this.data,
          timesPollIsShown,
          nextPollTime: moment().add(BACKOFF_PERIOD, 'seconds'),
          isEnabled: timesPollIsShown < 3,
        })
      ) {
        this.isPollVisible = true;
      }
    }
  },
  methods: {
    async saveData(data) {
      if (this.isSaving) return false;
      const settings = useSettingsStore();
      const previous = { ...settings.userSatisfactionPollData };
      this.isSaving = true;
      try {
        await settings.update({ userSatisfactionPollData: data });
        return true;
      } catch (err) {
        settings.$patch(state => {
          state.userSatisfactionPollData = previous;
        });
        console.error('无法保存满意度调查设置：', err);
        return false;
      } finally {
        this.isSaving = false;
      }
    },
    async submit() {
      if (!(await this.saveData({ ...this.data, isEnabled: false }))) return;
      this.isPollVisible = false;

      if (parseInt(this.rating) >= 6) {
        this.isPosFollowUpVisible = true;
      } else {
        this.isNegFollowUpVisible = true;
      }
    },
    async dontShowAgain() {
      if (!(await this.saveData({ ...this.data, isEnabled: false }))) return;
      this.isPollVisible = false;
    },
  },
};
</script>

<template lang="pug">
div
  div.d-flex.align-items-center.mb-3
    img(src="/logo.png" alt="ActivityWatch" style="height: 64px; width: auto; margin-right: 16px;")
    div
      h3.mb-0 {{ $t('home.greeting') }}
  p
    | {{ homeIntro1 }}
  p
    | {{ $t('home.intro3') }}
  p.mb-0 {{ $t('home.thanks') }}
  p
    a(href="https://forms.gle/q2N9K5RoERBV8kqPA") {{ $t('home.surveyFill') }}
    | &nbsp;{{ $t('home.surveyOr') }}&nbsp;
    a(href="https://forum.activitywatch.net/c/features") {{ $t('home.voteForum') }}
    | &nbsp;{{ $t('home.surveySuffix') }}

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.spreadTitle') }}
      p
        | {{ $t('home.spread1') }}
      ul
        li
          | {{ $t('home.spreadReview') }}
          |  #[a(href="https://alternativeto.net/software/activitywatch/") AlternativeTo]
        li
          | {{ $t('home.spreadVote') }}
          |  #[a(href="https://www.producthunt.com/posts/activitywatch") ProductHunt]
        li
          | {{ $t('home.spreadFollow') }}
          |  #[a(href="https://twitter.com/ActivityWatchIt") Twitter]
          |  /
          |  #[a(href="https://www.facebook.com/ActivityWatch") Facebook]
        li
          | {{ $t('home.spreadStar') }}
          |  #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]

    div.col-md-6
      h4 {{ $t('home.supportTitle') }}
      p(v-if="!isSupporter")
        | {{ $t('home.subscribeIntro') }}
        |  #[a(href="https://activitywatch.net/go/?src=inapp-home") {{ $t('home.subscribeCta') }}]
      p
        | {{ $t('home.support1') }}
      ul
        li #[a(href="https://www.patreon.com/erikbjare") Patreon]
        li #[a(href="https://opencollective.com/activitywatch") Open Collective]
        li #[a(href="https://liberapay.com/ActivityWatch/") Liberapay]
        li #[a(href="https://activitywatch.net/donate/") {{ $t('home.otherDonationMethods') }}]
      p
        | {{ $t('home.support2') }}
        |  #[a(href="https://activitywatch.net/donate/") {{ $t('home.donationPage') }}].

  // 二创作者的工作说明
  div.row
    div.col-12
      h4 {{ $t('home.forkWorkTitle') }}
      p
        | {{ $t('home.forkWork1') }}
      p
        | {{ $t('home.forkWork2') }}
      p
        small.text-muted
          | {{ $t('home.forkWork3') }}
          |  #[a(href="https://github.com/s13mjl/aw-tauri-zh") GitHub - s13mjl/aw-tauri-zh]

  hr

  div.row
    div.col-md-6
      h4 {{ $t('home.resourcesTitle') }}
      ul
        li #[a(href="https://activitywatch.net/") {{ $t('home.website') }}]
        li #[a(href="https://docs.activitywatch.net/") {{ $t('home.documentation') }}]
        li #[a(href="https://forum.activitywatch.net/") {{ $t('home.forum') }}]
        li #[a(href="https://discord.gg/vDskV9q") {{ $t('home.discord') }}]
        li #[a(href="https://www.reddit.com/r/activitywatch/") {{ $t('home.reddit') }}]
        li #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
        li(v-if="info && !info.version.includes('rust')") #[a(:href="apiBrowserUrl") {{ $t('home.apiBrowser') }}]

    div.col-md-6
      h4 {{ $t('home.workingOnTitle') }}
      p
        | {{ $t('home.workingOnPrefix') }}
        |  #[a(href="https://forum.activitywatch.net/c/news") {{ $t('home.devUpdates') }}]
        |  {{ $t('home.workingOnMiddle') }}
        |  #[a(href="https://github.com/ActivityWatch/activitywatch") GitHub]
        |  {{ $t('home.workingOnSuffix') }}

  hr

  p
    small
      i
        | {{ $t('home.landingHint') }}
        |  #[router-link(to="/settings") {{ $t('nav.settings') }}].

</template>

<script lang="ts">
import { mapState } from 'pinia';
import { useServerStore } from '~/stores/server';
import { useSettingsStore } from '~/stores/settings';

// Legacy honor-system "I already support" flag. The real flag now lives in the
// server settings store (`supporter`), so every browser and the desktop clients
// agree; this key is still honoured for users who set it before that existed.
const SUPPORTER_FLAG_KEY = 'aw-supporter';

export default {
  name: 'Home',
  computed: {
    ...mapState(useServerStore, ['info']),
    settingsStore() {
      return useSettingsStore();
    },
    // Server flag wins; fall back to the legacy localStorage flag when the
    // store is unavailable (e.g. an isolated unit test).
    isSupporter(): boolean {
      try {
        if (this.settingsStore.supporter) return true;
      } catch {
        // No active store — use the legacy flag.
      }
      try {
        return localStorage.getItem(SUPPORTER_FLAG_KEY) === 'true';
      } catch {
        return false;
      }
    },
    homeIntro1() {
      return this.$t('home.intro1');
    },
    apiBrowserUrl(): string {
      const base = window.location.pathname.replace(/[^/]*$/, '');
      return base + 'api/';
    },
  },
  mounted() {
    // Best-effort refresh: a flag set in another tab or on the Settings page
    // should suppress the prompt. A failed load falls back to the legacy flag.
    const settingsStore = useSettingsStore();
    Promise.resolve(settingsStore.load()).catch(() => undefined);
  },
};
</script>

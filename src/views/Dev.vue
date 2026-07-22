<template lang="pug">
div
  h3 {{ $t('dev.title') }}
  | {{ $t('dev.intro') }}

  p
    | {{ $t('dev.empty') }}
</template>

<script lang="ts">
export default {
  name: 'aw-dev',
};
</script>

<script>
    /** @type {{block: import('../states/blocks/text.svelte').Text}} */
    let { block } = $props();
</script>

<span bind:this={block.element} data-codex-text-index={block.index}></span>

<style lang="scss">

</style>
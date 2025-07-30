<script>
    import { untrack } from 'svelte';

    /** @type {{block: import('../states/blocks/linebreak.svelte').Linebreak}} */
    let { block } = $props();

    $effect(() => {
        if (block.element) untrack(() => console.log('Element linked to block:', block.element, 'at uuid', block.id));
    })
</script>

<br bind:this={block.element} data-codex-linebreak-index={block.index} />

<style lang="scss">

</style>
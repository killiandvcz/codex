<script>
    import { Operation } from "$lib/states/operations.svelte";
    import O from "$lib/debug/history/Operation.svelte";
    /** @type {{codex: import('$lib/states/codex.svelte').Codex}}*/
    let { codex } = $props();
</script>

<span class="label">history</span>
<div class="history">
    <div class="list">
        {#each codex.history as entry (entry.id)}
            {#if entry instanceof Operation}
                <O operation={entry} />
            {/if}
        {/each}
    </div>
</div>

<style>
    .history {
        padding: 1rem;
        background: var(--color-bg-secondary);
        border-radius: 0.5rem;
        margin-top: 1rem;
    }

    .list {
        display: flex;
        flex-direction: column;
        /* gap: 0.5rem; */
    }

    .label {
        font-weight: bold;
    }
</style>
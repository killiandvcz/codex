<script>
    import Structure from "./Structure.svelte";

    /** @type {{codex: import('$lib/states/codex.svelte').Codex}}*/
    let { codex } = $props();


</script>


<Structure {codex} />



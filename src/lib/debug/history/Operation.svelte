<script>
    /** @type {{operation: import('$lib/states/operations.svelte').Operation}}*/
    let {operation} = $props();
    const data = operation.toJSON();
    const debug = operation.debug ?? data.name
</script>

<div class="operation">
    <div class="timestamp">{"> "}{new Date(operation.timestamp).toLocaleTimeString()} - {debug}</div>
    

</div>

<style>
    .operation {
        display: flex;
        align-items: center;
        font-size: 12px;
        /* border-bottom: 1px solid #ccc; */

    }

    .timestamp {
        height: 24px;
        font-size: 12px;
        /* background: hsla(0, 0%, 85%); */
        padding: 4px 8px;
        /* width: 90px; */
    }

    .description {
        height: 24px;
        display: flex;
        align-items: center;
        /* background: hsla(0, 0%, 85%); */
        /* color: white; */
        padding: 4px 8px;

    }
</style>
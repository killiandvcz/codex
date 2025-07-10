<script>
    import './global.css';
    import { Codex } from '$lib/states/codex.svelte';
    
    
    const codex = new Codex();
    /** @type {import('$lib/components/Codex.svelte')}*/
    const Editor = codex.components["codex"];
    
    const selection = $derived(codex.selection);
</script>

<div class="_">
    <div class="editor">
        {#if Editor}
        <Editor {codex} />
        {/if}    
    </div>
    <div class="debug">
        <h2>Debug Information</h2>
        <pre>
            <code>
                {JSON.stringify(codex.debug, null, 2)}
            </code>
        </pre>
        
        <h3>Selection</h3>
        <br>
        {#if selection.range}
        <!-- Anchor -->
        <div class="row">
            <span class="label">Anchor</span>
            <span class="value">i{selection?.anchor?.block?.index}</span>
        </div>
        
        <!-- Focus -->
        <div class="row">
            <span class="label">Focus</span>
            <span class="value">i{selection?.focus?.block?.index}</span>
        </div>

        {/if}
        
        
    </div>
</div>

<style lang="scss">
    ._ {
        padding: 25px;
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: row;
        align-items: center;
        .row{
            display: flex;
            flex-direction: row;
            align-items: center;
            margin-bottom: 10px;
        }
        .label{
            display: inline-block;
            background: hsla(0, 0%, 0%, 0.9);
            color: white;
            padding: 5px;
            font-size: 12px;
        }
        .value {
            display: inline-block;
            background: hsla(0, 0%, 100%, 0.9);
            color: black;
            padding: 5px;
            font-size: 12px;
        }
        .editor {
            flex: 1;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .debug {
            flex: 1;
            height: 100%;
            overflow: auto;
            background-color: #f0f0f0;
            padding: 10px;
            border-left: 1px solid #ccc;
        }
    }
    
</style>

<script>
    import './global.css';
    import { Codex } from '$lib/states/codex.svelte';
    import History from '$lib/debug/History.svelte';
    import Debug from '$lib/debug/Debug.svelte';
    
    
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
        <Debug {codex} />
    </div>
</div>

<style lang="scss">
    ._ {
        padding: 25px;
        width: 100%;
        height: 100vh;
        display: flex;
        flex-direction: row;
        align-items: flex-start;
        gap: 20px;
        
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
            padding: 20px;
            border-left: 1px solid #ccc;
            
            h2 {
                margin-top: 0;
                margin-bottom: 20px;
                font-size: 20px;
            }
            
            h3 {
                margin-top: 20px;
                margin-bottom: 10px;
                font-size: 16px;
                font-weight: 600;
            }
            
            h4 {
                margin-top: 15px;
                margin-bottom: 10px;
                font-size: 14px;
                font-weight: 600;
                color: #555;
            }
            
            pre {
                background: white;
                padding: 10px;
                border-radius: 4px;
                overflow-x: auto;
                font-size: 12px;
                margin-bottom: 20px;
            }
            
            .selection-info {
                background: white;
                padding: 15px;
                border-radius: 4px;
            }
            
            .section {
                margin-bottom: 20px;
                padding-bottom: 15px;
                border-bottom: 1px solid #e0e0e0;
                
                &:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                
                h4 {
                    margin-top: 0;
                    margin-bottom: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #333;
                }
                
                ul {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    
                    li {
                        margin-bottom: 10px;
                        padding-left: 10px;
                        position: relative;
                        list-style: none;
                    }
                }
            }
            
            .row {
                display: flex;
                flex-direction: row;
                align-items: center;
                margin-bottom: 8px;
                gap: 10px;
                
                &:last-child {
                    margin-bottom: 0;
                }
            }
            
            .label {
                display: inline-block;
                background: hsla(0, 0%, 0%, 0.9);
                color: white;
                padding: 4px 8px;
                font-size: 12px;
                font-weight: 500;
                border-radius: 3px;
                min-width: 120px;
            }
            
            .value {
                display: inline-block;
                background: hsla(0, 0%, 95%, 1);
                color: black;
                padding: 4px 8px;
                font-size: 12px;
                font-family: monospace;
                border-radius: 3px;
                flex: 1;
            }
            
            .no-selection {
                color: #888;
                font-style: italic;
                padding: 10px;
                background: white;
                border-radius: 4px;
                text-align: center;
            }
        }
    }
</style>
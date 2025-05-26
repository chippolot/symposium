import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { PresetPersona } from '@/lib/supabase'
import { User, Plus, Sparkles } from 'lucide-react'

interface PersonaSelectorProps {
    selectedPersona: {
        type: 'none' | 'preset' | 'custom'
        name?: string
        description?: string
        presetId?: string
    }
    onPersonaChange: (persona: {
        type: 'none' | 'preset' | 'custom'
        name?: string
        description?: string
        presetId?: string
    }) => void
}

export default function PersonaSelector({ selectedPersona, onPersonaChange }: PersonaSelectorProps) {
    const [presetPersonas, setPresetPersonas] = useState<PresetPersona[]>([])
    const [showCustomForm, setShowCustomForm] = useState(false)
    const [customName, setCustomName] = useState('')
    const [customDescription, setCustomDescription] = useState('')

    useEffect(() => {
        loadPresetPersonas()
    }, [])

    const loadPresetPersonas = async () => {
        const { data, error } = await supabase
            .from('preset_personas')
            .select('*')
            .order('name')

        if (!error && data) {
            setPresetPersonas(data)
        }
    }

    const handlePresetSelect = (persona: PresetPersona) => {
        onPersonaChange({
            type: 'preset',
            name: persona.name,
            description: persona.description,
            presetId: persona.id
        })
        setShowCustomForm(false)
    }

    const handleCustomCreate = () => {
        if (customName.trim() && customDescription.trim()) {
            onPersonaChange({
                type: 'custom',
                name: customName.trim(),
                description: customDescription.trim()
            })
            setCustomName('')
            setCustomDescription('')
            setShowCustomForm(false)
        }
    }

    const handleNoPersona = () => {
        onPersonaChange({ type: 'none' })
        setShowCustomForm(false)
    }

    return (
        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-amber-900 mb-3">
                    <Sparkles className="inline h-4 w-4 mr-2" />
                    Choose a Philosophical Persona
                </label>
                <p className="text-sm text-amber-700 mb-4">
                    Select who you'd like to engage in dialogue with, or proceed without a specific persona.
                </p>
            </div>

            {/* No Persona Option */}
            <div
                onClick={handleNoPersona}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedPersona.type === 'none'
                        ? 'border-amber-500 bg-amber-50 shadow-md'
                        : 'border-amber-200 hover:border-amber-300 hover:bg-amber-50/50'
                    }`}
            >
                <div className="flex items-center space-x-3">
                    <User className="h-5 w-5 text-amber-700" />
                    <div>
                        <h3 className="font-medium text-amber-900">Standard AI Assistant</h3>
                        <p className="text-sm text-amber-700">Engage with a helpful AI without a specific persona</p>
                    </div>
                </div>
            </div>

            {/* Preset Personas */}
            <div className="space-y-2">
                <h4 className="font-medium text-amber-900 text-sm">Great Philosophers</h4>
                {presetPersonas.map((persona) => (
                    <div
                        key={persona.id}
                        onClick={() => handlePresetSelect(persona)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${selectedPersona.type === 'preset' && selectedPersona.presetId === persona.id
                                ? 'border-amber-500 bg-amber-50 shadow-md'
                                : 'border-amber-200 hover:border-amber-300 hover:bg-amber-50/50'
                            }`}
                    >
                        <div>
                            <h3 className="font-medium text-amber-900">{persona.name}</h3>
                            <p className="text-sm text-amber-700 mt-1">{persona.description}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Custom Persona */}
            <div className="space-y-3">
                <h4 className="font-medium text-amber-900 text-sm">Create Custom Persona</h4>

                {!showCustomForm ? (
                    <button
                        onClick={() => setShowCustomForm(true)}
                        className={`w-full p-4 rounded-xl border border-dashed cursor-pointer transition-all ${selectedPersona.type === 'custom'
                                ? 'border-amber-500 bg-amber-50'
                                : 'border-amber-300 hover:border-amber-400 hover:bg-amber-50/50'
                            }`}
                    >
                        <div className="flex items-center justify-center space-x-2 text-amber-700">
                            <Plus className="h-5 w-5" />
                            <span className="font-medium">Create Your Own Persona</span>
                        </div>
                    </button>
                ) : (
                    <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 space-y-3">
                        <input
                            type="text"
                            placeholder="Persona name (e.g., 'Marcus Aurelius', 'A Zen Master')"
                            value={customName}
                            onChange={(e) => setCustomName(e.target.value)}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                        />
                        <textarea
                            placeholder="Describe this persona's philosophy, personality, and how they should engage in dialogue..."
                            value={customDescription}
                            onChange={(e) => setCustomDescription(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none"
                        />
                        <div className="flex space-x-2">
                            <button
                                onClick={handleCustomCreate}
                                disabled={!customName.trim() || !customDescription.trim()}
                                className="flex-1 bg-amber-700 text-white py-2 px-4 rounded-lg hover:bg-amber-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Create Persona
                            </button>
                            <button
                                onClick={() => {
                                    setShowCustomForm(false)
                                    setCustomName('')
                                    setCustomDescription('')
                                }}
                                className="flex-1 border border-amber-300 text-amber-700 py-2 px-4 rounded-lg hover:bg-amber-50 transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                {selectedPersona.type === 'custom' && selectedPersona.name && (
                    <div className="p-3 rounded-lg bg-amber-100 border border-amber-200">
                        <h4 className="font-medium text-amber-900">{selectedPersona.name}</h4>
                        <p className="text-sm text-amber-700 mt-1">{selectedPersona.description}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
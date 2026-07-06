Pod::Spec.new do |s|
  s.name           = 'OrderLiveActivity'
  s.version        = '1.0.0'
  s.summary        = "ActivityKit bridge for Mandy's order-tracking Live Activity"
  s.description    = "Starts/updates/ends the Mandy's order Live Activity and renders the delivery map snapshot into the App Group container."
  s.author         = "Mandy's Bubble Tea"
  s.homepage       = 'https://mandybubbletea.com'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.license        = { :type => 'MIT' }

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,swift}'
end
